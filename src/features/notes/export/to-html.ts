import type { JSONContent } from '@tiptap/react'
import { formatDueDateTime } from '@/lib/date'
import { drawingRaster, imageRaster } from './export-assets'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const safeColor = (c: unknown) => (typeof c === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,]+\))$/i.test(c) ? c : null)
const safeFont = (f: unknown) => (typeof f === 'string' && /^[\w\s"',-]+$/.test(f) ? f : null)

function inline(nodes: JSONContent[] | undefined): string {
  let out = ''
  for (const n of nodes ?? []) {
    if (n.type === 'hardBreak') { out += '<br>'; continue }
    if (n.type === 'mention') { out += `<b style="color:#3e63dd">@${esc(String(n.attrs?.label ?? n.attrs?.handle ?? ''))}</b>`; continue }
    if (n.type === 'noteDate') { out += `<span style="color:#0090ff">${esc(n.attrs?.iso ? formatDueDateTime(String(n.attrs.iso)) : '')}</span>`; continue }
    if (n.type !== 'text' || !n.text) continue
    let t = esc(n.text)
    const css: string[] = []
    for (const m of n.marks ?? []) {
      if (m.type === 'bold') t = `<b>${t}</b>`
      else if (m.type === 'italic') t = `<i>${t}</i>`
      else if (m.type === 'underline') t = `<u>${t}</u>`
      else if (m.type === 'strike') t = `<s>${t}</s>`
      else if (m.type === 'code') t = `<code>${t}</code>`
      else if (m.type === 'link' && /^https?:\/\//i.test(String(m.attrs?.href ?? ''))) t = `<a href="${esc(String(m.attrs!.href))}">${t}</a>`
      else if (m.type === 'highlight' && safeColor(m.attrs?.color)) css.push(`background-color:${m.attrs!.color}`)
      else if (m.type === 'textStyle') {
        if (safeColor(m.attrs?.color)) css.push(`color:${m.attrs!.color}`)
        if (/^\d{1,2}px$/.test(String(m.attrs?.fontSize ?? ''))) css.push(`font-size:${Math.round(parseInt(String(m.attrs!.fontSize), 10) * 0.75)}pt`)
        if (safeFont(m.attrs?.fontFamily)) css.push(`font-family:${m.attrs!.fontFamily}`)
      }
    }
    out += css.length ? `<span style="${esc(css.join(';'))}">${t}</span>` : t
  }
  return out
}

async function blocks(nodes: JSONContent[] | undefined): Promise<string> {
  let out = ''
  for (const n of nodes ?? []) {
    const a = n.attrs ?? {}
    const style = [a.textAlign && a.textAlign !== 'left' ? `text-align:${a.textAlign}` : '', Number(a.lineHeight) ? `line-height:${Number(a.lineHeight)}` : ''].filter(Boolean).join(';')
    const st = style ? ` style="${style}"` : ''
    switch (n.type) {
      case 'paragraph': out += `<p${st}>${inline(n.content) || '<br>'}</p>`; break
      case 'heading': out += `<h${Number(a.level) || 1}${st}>${inline(n.content)}</h${Number(a.level) || 1}>`; break
      case 'bulletList': out += `<ul>${await blocks(n.content)}</ul>`; break
      case 'orderedList': out += `<ol>${await blocks(n.content)}</ol>`; break
      case 'taskList': out += `<ul style="list-style:none">${await blocks(n.content)}</ul>`; break
      case 'listItem': out += `<li>${await blocks(n.content)}</li>`; break
      case 'taskItem': out += `<li>${a.checked ? '☑' : '☐'} ${(await blocks(n.content)).replace(/^<p>|<\/p>$/g, '')}</li>`; break
      case 'blockquote': out += `<blockquote>${await blocks(n.content)}</blockquote>`; break
      case 'codeBlock': out += `<pre><code>${inline(n.content)}</code></pre>`; break
      case 'horizontalRule': out += '<hr>'; break
      case 'image': {
        const r = await imageRaster(a)
        const pct = Number(a.widthPct) || ({ small: 33, medium: 55, large: 80 } as Record<string, number>)[String(a.size)] || 100
        if (r) out += `<p style="text-align:center"><img src="${r.dataUrl}" width="${Math.round(6.5 * 96 * pct / 100)}"></p>`
        break
      }
      case 'noteDrawing': {
        const r = await drawingRaster(a)
        if (r) out += `<p><img src="${r.dataUrl}" width="624"></p>`
        break
      }
      case 'noteFile': out += `<p><i>📎 ${esc(String(a.name ?? 'File'))}</i></p>`; break
      default: if (n.content) out += await blocks(n.content)
    }
  }
  return out
}

/** The note as clean HTML with its pictures inside it: what Google Docs (or any editor) keeps when it is pasted. */
export async function noteToHtml(title: string, doc: JSONContent, titleAtTop = true): Promise<string> {
  return `${titleAtTop ? `<h1>${esc(title || 'Untitled note')}</h1>` : ''}${await blocks(doc.content)}`
}
