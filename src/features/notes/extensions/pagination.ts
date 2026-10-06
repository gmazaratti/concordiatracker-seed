import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'

/** Page geometry, in CSS px at 96 dpi: a letter sheet with one-inch margins. */
export const PAGE = { height: 1056, margin: 96, gap: 28 }
export const CONTENT_HEIGHT = PAGE.height - 2 * PAGE.margin
/** From the top of one page's text to the top of the next page's text. */
export const PAGE_PITCH = PAGE.height + PAGE.gap

interface Break { pos: number; height: number }
interface Storage { enabled: boolean; onPages: (n: number) => void; refresh: () => void }

const key = new PluginKey<DecorationSet>('ct-pagination')
const LISTS = new Set(['bulletList', 'orderedList', 'taskList'])

/** Each unit that must not be split across pages: a paragraph, a heading, an
 *  image, or one item of a list (so a long list can still break between items). */
function units(state: EditorState): number[] {
  const out: number[] = []
  state.doc.forEach((node, offset) => {
    if (LISTS.has(node.type.name)) node.forEach((_c, o) => out.push(offset + 1 + o))
    else out.push(offset)
  })
  return out
}

/**
 * Where the page breaks fall, from where each block sits in the editor.
 *
 * Positions are measured WITHOUT the gaps this plugin already inserted (their
 * heights are subtracted), so measuring again after the gaps are in gives the
 * same answer and the layout settles instead of oscillating.
 */
export function layoutBreaks(blocks: { pos: number; top: number; bottom: number }[]): { breaks: Break[]; pages: number } {
  const breaks: Break[] = []
  let shift = 0
  let last = 0
  for (const b of blocks) {
    const t = b.top + shift
    const bot = b.bottom + shift
    const page = Math.floor(t / PAGE_PITCH)
    const end = page * PAGE_PITCH + CONTENT_HEIGHT
    const startsInGap = t > end
    const crosses = bot > end + 1 && b.bottom - b.top <= CONTENT_HEIGHT && t > page * PAGE_PITCH + 1
    if (startsInGap || crosses) {
      const h = Math.round((page + 1) * PAGE_PITCH - t)
      if (h > 0) {
        breaks.push({ pos: b.pos, height: h })
        shift += h
      }
    }
    last = Math.max(last, b.bottom + shift)
  }
  return { breaks, pages: Math.max(1, Math.floor(Math.max(0, last - 1) / PAGE_PITCH) + 1) }
}

function measure(view: EditorView): { pos: number; top: number; bottom: number }[] {
  const root = view.dom as HTMLElement
  const rr = root.getBoundingClientRect()
  // CSS zoom on the page scales what getBoundingClientRect reports.
  const scale = root.offsetHeight > 0 && rr.height > 0 ? rr.height / root.offsetHeight : 1
  const gaps = [...root.querySelectorAll<HTMLElement>('.ct-page-gap')].map((g) => {
    const r = g.getBoundingClientRect()
    return { top: (r.top - rr.top) / scale, h: r.height / scale }
  })
  const out: { pos: number; top: number; bottom: number }[] = []
  for (const pos of units(view.state)) {
    const el = view.nodeDOM(pos)
    if (!(el instanceof HTMLElement)) continue
    const r = el.getBoundingClientRect()
    const top = (r.top - rr.top) / scale
    const before = gaps.reduce((s, g) => (g.top <= top ? s + g.h : s), 0)
    out.push({ pos, top: top - before, bottom: top - before + r.height / scale })
  }
  return out
}

function gapWidget(height: number) {
  const el = document.createElement('div')
  el.className = 'ct-page-gap'
  el.contentEditable = 'false'
  el.setAttribute('aria-hidden', 'true')
  el.style.height = `${height}px`
  return el
}

/**
 * Real page breaks for the "Pages" layout: a block that would cross the
 * bottom margin of a sheet is pushed onto the next one, so the text sits on
 * separate pages with space between them, like a word processor. The sheets
 * themselves are drawn by NotePaper from the page count this reports.
 */
export const Pagination = Extension.create<Record<string, never>, Storage>({
  name: 'pagination',
  addStorage() {
    return { enabled: false, onPages: () => {}, refresh: () => {} }
  },
  addProseMirrorPlugins() {
    const storage = this.storage
    let current: Break[] = []
    let timer: ReturnType<typeof setTimeout> | null = null
    let lastPages = 0

    const run = (view: EditorView) => {
      timer = null
      if (view.isDestroyed) return
      const next = storage.enabled ? layoutBreaks(measure(view)) : { breaks: [], pages: 1 }
      if (next.pages !== lastPages) {
        lastPages = next.pages
        storage.onPages(next.pages)
      }
      const same = next.breaks.length === current.length && next.breaks.every((b, i) => b.pos === current[i].pos && Math.abs(b.height - current[i].height) < 2)
      if (same) return
      current = next.breaks
      view.dispatch(view.state.tr.setMeta(key, next.breaks).setMeta('addToHistory', false))
    }

    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const meta = tr.getMeta(key) as Break[] | undefined
            if (meta) {
              return DecorationSet.create(tr.doc, meta.map((b) =>
                Decoration.widget(b.pos, () => gapWidget(b.height), { side: -1, key: `pg-${b.pos}-${b.height}` })))
            }
            return set.map(tr.mapping, tr.doc)
          },
        },
        props: { decorations: (state) => key.getState(state) },
        view(view) {
          const schedule = () => {
            if (!timer) timer = setTimeout(() => run(view), 30)
          }
          const ro = new ResizeObserver(schedule)
          ro.observe(view.dom)
          storage.refresh = () => {
            lastPages = 0
            schedule()
          }
          schedule()
          return {
            update: (_v, prev) => {
              if (prev.doc !== view.state.doc) schedule()
            },
            destroy: () => {
              ro.disconnect()
              // Cleared AND forgotten: the editor re-creates plugin views when
              // its plugins change, and a stale id here would make every later
              // schedule() think a run is already pending.
              if (timer) clearTimeout(timer)
              timer = null
            },
          }
        },
      }),
    ]
  },
})
