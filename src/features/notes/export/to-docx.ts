import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, Header, HeadingLevel, ImageRun, LevelFormat, Packer,
  PageNumber, Paragraph, ShadingType, Tab, TabStopType, TextRun, type ParagraphChild,
} from 'docx'
import type { JSONContent } from '@tiptap/react'
import { formatDueDateTime } from '@/lib/date'
import { drawingRaster, imageRaster, type Raster } from './export-assets'
import { hasBand, type Band, type PageSetup } from '../page-setup'

const PAGE_PX = 624 // 6.5 in of text width at 96 dpi
const ALIGN = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED } as const
const HEADINGS = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 } as const

const hex = (c: unknown): string | undefined => {
  if (typeof c !== 'string') return undefined
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.slice(1)
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/)
  if (!m) return undefined
  // A translucent highlight as it looks on white paper.
  const a = m[4] ? Number(m[4]) : 1
  return [m[1], m[2], m[3]].map((v) => Math.round(Number(v) * a + 255 * (1 - a)).toString(16).padStart(2, '0')).join('')
}

function runs(nodes: JSONContent[] | undefined, extra: { code?: boolean } = {}): ParagraphChild[] {
  const out: ParagraphChild[] = []
  for (const n of nodes ?? []) {
    if (n.type === 'hardBreak') { out.push(new TextRun({ text: '', break: 1 })); continue }
    if (n.type === 'mention') { out.push(new TextRun({ text: `@${n.attrs?.label ?? n.attrs?.handle ?? ''}`, bold: true, color: '3e63dd' })); continue }
    if (n.type === 'noteDate') { out.push(new TextRun({ text: n.attrs?.iso ? formatDueDateTime(String(n.attrs.iso)) : '', color: '0090ff' })); continue }
    if (n.type !== 'text' || !n.text) continue
    const marks = n.marks ?? []
    const style = marks.find((m) => m.type === 'textStyle')?.attrs ?? {}
    const hl = marks.find((m) => m.type === 'highlight')?.attrs?.color
    const link = marks.find((m) => m.type === 'link')?.attrs?.href as string | undefined
    const size = parseInt(String(style.fontSize ?? ''), 10)
    const run = new TextRun({
      text: n.text,
      bold: marks.some((m) => m.type === 'bold'),
      italics: marks.some((m) => m.type === 'italic'),
      underline: marks.some((m) => m.type === 'underline') || link ? {} : undefined,
      strike: marks.some((m) => m.type === 'strike'),
      color: link ? '1155cc' : hex(style.color),
      size: Number.isFinite(size) ? Math.round(size * 1.5) : undefined,
      font: extra.code || marks.some((m) => m.type === 'code') ? 'Courier New' : typeof style.fontFamily === 'string' ? style.fontFamily.split(',')[0].replace(/["']/g, '').trim() : undefined,
      shading: hl ? { type: ShadingType.CLEAR, fill: hex(hl) ?? 'fff3b0', color: 'auto' } : undefined,
    })
    out.push(link && /^https?:\/\//i.test(link) ? new ExternalHyperlink({ link, children: [run] }) : run)
  }
  return out
}

function picture(r: Raster, pct: number): Paragraph {
  const w = Math.round((PAGE_PX * Math.min(100, Math.max(10, pct))) / 100)
  return new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: r.type, data: r.data, transformation: { width: w, height: Math.round((w * r.height) / r.width) } })] })
}

async function blocks(nodes: JSONContent[] | undefined, ctx: { level: number; list?: 'bullet' | 'ordered' | 'task'; checked?: boolean }): Promise<Paragraph[]> {
  const out: Paragraph[] = []
  for (const n of nodes ?? []) {
    const a = n.attrs ?? {}
    const lh = Number(a.lineHeight)
    const common = {
      alignment: ALIGN[(a.textAlign as keyof typeof ALIGN) ?? 'left'],
      spacing: Number.isFinite(lh) && lh > 0 ? { line: Math.round(lh * 240), after: 120 } : { after: 120 },
    }
    switch (n.type) {
      case 'paragraph': {
        const children = runs(n.content)
        if (ctx.list === 'task') children.unshift(new TextRun({ text: ctx.checked ? '☑ ' : '☐ ' }))
        out.push(new Paragraph({
          ...common,
          children,
          ...(ctx.list === 'bullet' ? { bullet: { level: ctx.level } } : {}),
          ...(ctx.list === 'ordered' ? { numbering: { reference: 'ct-ol', level: ctx.level } } : {}),
          ...(ctx.list === 'task' ? { indent: { left: 360 * (ctx.level + 1) } } : {}),
        }))
        break
      }
      case 'heading':
        out.push(new Paragraph({ ...common, heading: HEADINGS[(a.level as 1 | 2 | 3) ?? 1] ?? HeadingLevel.HEADING_1, children: runs(n.content) }))
        break
      case 'bulletList':
      case 'orderedList':
      case 'taskList': {
        const list = n.type === 'bulletList' ? 'bullet' : n.type === 'orderedList' ? 'ordered' : 'task'
        for (const item of n.content ?? []) {
          out.push(...(await blocks(item.content, { level: ctx.list ? ctx.level + 1 : 0, list, checked: !!item.attrs?.checked })))
        }
        break
      }
      case 'blockquote':
        for (const p of await blocks(n.content, ctx)) out.push(p)
        break
      case 'codeBlock':
        out.push(new Paragraph({ shading: { type: ShadingType.CLEAR, fill: 'f1f3f4', color: 'auto' }, children: runs(n.content, { code: true }) }))
        break
      case 'horizontalRule':
        out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'cccccc', space: 1 } }, children: [] }))
        break
      case 'image': {
        const r = await imageRaster(a)
        if (r) out.push(picture(r, Number(a.widthPct) || ({ small: 33, medium: 55, large: 80 } as Record<string, number>)[String(a.size)] || 100))
        break
      }
      case 'noteDrawing': {
        const r = await drawingRaster(a)
        if (r) out.push(picture(r, 100))
        break
      }
      case 'noteFile':
        out.push(new Paragraph({ children: [new TextRun({ text: `📎 ${String(a.name ?? 'File')}`, italics: true, color: '666666' })] }))
        break
      default:
        if (n.content) out.push(...(await blocks(n.content, ctx)))
    }
  }
  return out
}

/** One header or footer cell as Word runs, with {page} and {pages} as live fields. */
function cell(text: string, title: string, date: string): TextRun[] {
  return text.split(/(\{page\}|\{pages\}|\{title\}|\{date\})/).filter(Boolean).map((p) =>
    p === '{page}' ? new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '555555' })
      : p === '{pages}' ? new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: '555555' })
        : new TextRun({ text: p === '{title}' ? title || 'Untitled note' : p === '{date}' ? date : p, size: 18, color: '555555' }))
}

/** Left, centre and right on one line, held apart by a centre and a right tab stop. */
function bandParagraph(band: Band, line: boolean, edge: 'top' | 'bottom', title: string, date: string): Paragraph {
  const rule = line ? { [edge === 'top' ? 'bottom' : 'top']: { style: BorderStyle.SINGLE, size: 4, color: '999999', space: 4 } } : undefined
  return new Paragraph({
    tabStops: [{ type: TabStopType.CENTER, position: 4680 }, { type: TabStopType.RIGHT, position: 9360 }],
    border: rule,
    children: [...cell(band.left, title, date), new TextRun({ children: [new Tab()] }), ...cell(band.center, title, date), new TextRun({ children: [new Tab()] }), ...cell(band.right, title, date)],
  })
}

/** The note as a Word document: opens in Word, Pages and LibreOffice, and Google Docs converts it on upload. */
export async function noteToDocx(title: string, doc: JSONContent, setup?: PageSetup, titleAtTop = true): Promise<Blob> {
  const body = await blocks(doc.content, { level: 0 })
  const date = new Date().toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })
  const header = setup && hasBand(setup.header) ? new Header({ children: [bandParagraph(setup.header, setup.headerLine, 'top', title, date)] }) : undefined
  const footer = setup && hasBand(setup.footer) ? new Footer({ children: [bandParagraph(setup.footer, setup.footerLine, 'bottom', title, date)] }) : undefined
  const skipFirst = !!setup && !setup.firstPage && !!(header || footer)
  const file = new Document({
    title: title || 'Note',
    creator: 'ConcordiaTracker',
    styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
    numbering: {
      config: [{
        reference: 'ct-ol',
        levels: [0, 1, 2, 3].map((level) => ({
          level, format: level % 2 ? LevelFormat.LOWER_LETTER : LevelFormat.DECIMAL, text: `%${level + 1}.`,
          alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
        })),
      }],
    },
    sections: [{
      properties: { titlePage: skipFirst },
      headers: header ? { default: header, ...(skipFirst ? { first: new Header({ children: [] }) } : {}) } : undefined,
      footers: footer ? { default: footer, ...(skipFirst ? { first: new Footer({ children: [] }) } : {}) } : undefined,
      children: [...(titleAtTop ? [new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(title || 'Untitled note')] })] : []), ...body] }],
  })
  return Packer.toBlob(file)
}
