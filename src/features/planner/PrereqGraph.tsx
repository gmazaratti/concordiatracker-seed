import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GripVertical, Loader2, Maximize2, Search, Trash2, X } from 'lucide-react'
import {
  browseCourses,
  coursesByCodes,
  extractCourseCodes,
  mySubjects,
  searchCourses,
  unlockedBy,
  type CatalogCourse,
} from '@/lib/catalog'
import { normalizeCode } from '@/lib/prereq'
import { CourseSkeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { CARD_H, CARD_W, extent, layout, type Positioned } from './graph-layout'

/**
 * The prerequisite map as a board you build.
 *
 * A library on the left, a canvas on the right, and an arrow between any two
 * cards where one is a prerequisite of the other. The arrows are NOT decoration
 * and NOT guessed: they come from the same extracted codes the rest of the
 * planner reads, so a line means Concordia's calendar names that course in the
 * other's prerequisite. Where the wording is a rule we cannot parse ("18
 * credits in the programme"), no line is drawn rather than a wrong one.
 *
 * Dropping a course pulls in what it needs and what it opens, so one drag gives
 * a chain rather than a lone card. Placement is handed to `graph-layout`, which
 * lays everything out in rows by depth — the first version offset neighbours
 * from the drop point, which piled three cards on the same spot.
 */

const MIN_ZOOM = 0.4
const MAX_ZOOM = 1.4
const MINIMAP_W = 168

interface Node extends Positioned {
  course: CatalogCourse
}

const codeOf = (c: CatalogCourse) => `${c.subject} ${c.catalog}`

export function PrereqGraph({
  completed,
  trusted,
  starters,
  onOpenList,
}: {
  completed: Set<string>
  trusted: boolean
  /** The student's own courses — somewhere to start without typing. */
  starters: string[]
  /** Jump to the list view for a course, which answers a different question. */
  onOpenList: (code: string) => void
}) {
  const [nodes, setNodes] = useState<Node[]>([])
  const [query, setQuery] = useState('')
  const [library, setLibrary] = useState<CatalogCourse[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [pulling, setPulling] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [view, setView] = useState({ x: 0, y: 0, w: 0, h: 0 })

  const scrollRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<{ code: string; dx: number; dy: number } | null>(null)

  // The library is never empty: with no search it shows the subjects the
  // student's own record is in, which is the shelf they would have reached for.
  useEffect(() => {
    let alive = true
    void (async () => {
      const subs = await mySubjects().catch(() => [])
      const page = await browseCourses({ subjects: subs.slice(0, 3), limit: 40 }).catch(() => ({
        rows: [],
        total: 0,
      }))
      if (alive) setLibrary(page.rows)
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) return
    let alive = true
    const id = window.setTimeout(() => {
      setSearching(true)
      void searchCourses(term, 30)
        .then((r) => alive && setLibrary(r))
        .catch(() => alive && setLibrary([]))
        .finally(() => alive && setSearching(false))
    }, 220)
    return () => {
      alive = false
      window.clearTimeout(id)
    }
  }, [query])

  /** Re-run the layered layout over whatever is on the board. */
  const arrange = useCallback((list: Node[]): Node[] => {
    const previous = new Map(list.map((n) => [n.code, n]))
    const placed = layout(
      list.map((n) => ({ code: n.code, needs: extractCourseCodes(n.course.prerequisites) })),
      previous,
    )
    const at = new Map(placed.map((p) => [p.code, p]))
    return list.map((n) => ({ ...n, ...(at.get(n.code) ?? { x: n.x, y: n.y }) }))
  }, [])

  /** Place a course, then pull in its neighbours and lay the lot out. */
  const add = useCallback(
    async (course: CatalogCourse) => {
      const code = codeOf(course)
      if (nodes.some((n) => n.code === code)) return

      setNodes((prev) => arrange([...prev, { code, course, x: 0, y: 0 }]))
      setPulling(code)
      const needs = extractCourseCodes(course.prerequisites)
      const [parents, children] = await Promise.all([
        needs.length ? coursesByCodes(needs).catch(() => []) : Promise.resolve([]),
        unlockedBy(code, 6).catch(() => []),
      ])
      setPulling(null)

      setNodes((prev) => {
        const have = new Set(prev.map((n) => n.code))
        const next = [...prev]
        for (const c of [...parents, ...children.slice(0, 4)]) {
          const key = codeOf(c)
          if (have.has(key)) continue
          have.add(key)
          next.push({ code: key, course: c, x: 0, y: 0 })
        }
        return arrange(next)
      })
    },
    [nodes, arrange],
  )

  /** Every arrow whose two ends are both on the board. */
  const edges = useMemo(() => {
    const index = new Map(nodes.map((n) => [normalizeCode(n.code), n]))
    const out: { from: Node; to: Node }[] = []
    for (const n of nodes) {
      for (const need of extractCourseCodes(n.course.prerequisites)) {
        const parent = index.get(normalizeCode(need))
        if (parent && parent.code !== n.code) out.push({ from: parent, to: n })
      }
    }
    return out
  }, [nodes])

  const board = useMemo(() => {
    const e = extent(nodes)
    // A floor, so an empty or one-card board still fills its frame rather than
    // collapsing to a 200px box in the corner.
    return { w: Math.max(e.w, 900), h: Math.max(e.h, 600) }
  }, [nodes])

  /** Keep the minimap's viewport rectangle honest as the board is scrolled. */
  const trackView = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setView({
      x: el.scrollLeft / zoom,
      y: el.scrollTop / zoom,
      w: el.clientWidth / zoom,
      h: el.clientHeight / zoom,
    })
  }, [zoom])

  useEffect(() => {
    trackView()
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(trackView)
    ro.observe(el)
    return () => ro.disconnect()
  }, [trackView, nodes.length])

  const mapScale = MINIMAP_W / board.w
  const mapH = Math.max(60, Math.round(board.h * mapScale))

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100svh-220px)] lg:min-h-[560px] lg:flex-row">
      {/* ── Library ─────────────────────────────────────────────────────── */}
      <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface lg:w-[300px] lg:shrink-0">
        <div className="border-b border-border p-2.5">
          <div className="relative">
            <Search
              size={14}
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the calendar"
              aria-label="Search courses"
              className="w-full rounded-lg border border-border bg-canvas py-2 pr-8 pl-8.5 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
            {searching && (
              <Loader2
                size={13}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 animate-spin text-subtle"
                aria-hidden
              />
            )}
          </div>

          {/* Yours, right here. It used to live above the board next to a second
              search box, which meant two places to start and no reason to
              prefer either. */}
          {starters.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-[10.5px] font-semibold tracking-wide text-subtle uppercase">
                Yours
              </p>
              <div className="flex flex-wrap gap-1">
                {starters.slice(0, 6).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      const hit = library?.find((c) => codeOf(c) === code)
                      if (hit) void add(hit)
                      else void searchCourses(code, 1).then((r) => r[0] && add(r[0]))
                    }}
                    className="rounded-md border border-border bg-canvas px-1.5 py-1 text-[11px] font-medium text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {library === null ? (
            <CourseSkeleton rows={5} />
          ) : library.length === 0 ? (
            <p className="px-2 py-8 text-center text-[12.5px] text-subtle">
              Nothing in the calendar matches that.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {library.map((c) => {
                const on = nodes.some((n) => n.code === codeOf(c))
                return (
                  <li key={c.id || codeOf(c)}>
                    <button
                      type="button"
                      draggable={!on}
                      onDragStart={(e) =>
                        e.dataTransfer.setData('text/ct-course', JSON.stringify(c))
                      }
                      onClick={() => void add(c)}
                      disabled={on}
                      className={cn(
                        'w-full cursor-grab rounded-lg border px-2.5 py-2 text-left transition-colors duration-150 active:cursor-grabbing',
                        on
                          ? 'border-accent/40 bg-accent-soft/40 opacity-60'
                          : 'border-border bg-canvas hover:border-accent',
                      )}
                    >
                      <span className="flex items-baseline gap-1.5">
                        <span className="text-[12.5px] font-semibold text-fg">{codeOf(c)}</span>
                        {on && <span className="text-[10.5px] text-accent">on the board</span>}
                      </span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-muted">
                        {c.title}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-[11px] leading-snug text-subtle">
                        {c.description ?? 'No description in the mirror yet.'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* ── Board ───────────────────────────────────────────────────────── */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          onScroll={trackView}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const raw = e.dataTransfer.getData('text/ct-course')
            if (raw) void add(JSON.parse(raw) as CatalogCourse)
          }}
          className="ct-grid-bg relative h-[60svh] flex-1 overflow-auto rounded-xl border border-border bg-canvas lg:h-auto"
        >
          {/* One scaled layer holds the arrows and the cards together, so zoom
              cannot drift them apart. */}
          <div
            style={{
              width: board.w * zoom,
              height: board.h * zoom,
              position: 'relative',
            }}
          >
            <div
              style={{
                width: board.w,
                height: board.h,
                transform: `scale(${zoom})`,
                transformOrigin: '0 0',
                position: 'absolute',
                inset: 0,
              }}
            >
              <svg className="pointer-events-none absolute inset-0" width={board.w} height={board.h}>
                <defs>
                  <marker
                    id="ct-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" className="fill-border-strong" />
                  </marker>
                </defs>
                {edges.map(({ from, to }, i) => (
                  <line
                    key={i}
                    x1={from.x + CARD_W / 2}
                    y1={from.y + CARD_H}
                    x2={to.x + CARD_W / 2}
                    y2={to.y - 6}
                    className="stroke-border-strong"
                    strokeWidth={1.5}
                    markerEnd="url(#ct-arrow)"
                  />
                ))}
              </svg>

              {nodes.map((n) => {
                const done = completed.has(normalizeCode(n.code))
                return (
                  <div
                    key={n.code}
                    style={{ left: n.x, top: n.y, width: CARD_W, height: CARD_H }}
                    onPointerDown={(e) => {
                      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
                      e.currentTarget.setPointerCapture(e.pointerId)
                      // Divided by zoom: the pointer moves in screen pixels,
                      // the card lives in board coordinates.
                      dragging.current = {
                        code: n.code,
                        dx: e.clientX / zoom - n.x,
                        dy: e.clientY / zoom - n.y,
                      }
                    }}
                    onPointerMove={(e) => {
                      const d = dragging.current
                      if (d?.code !== n.code) return
                      const x = Math.max(0, e.clientX / zoom - d.dx)
                      const y = Math.max(0, e.clientY / zoom - d.dy)
                      setNodes((prev) => prev.map((p) => (p.code === n.code ? { ...p, x, y } : p)))
                    }}
                    onPointerUp={() => {
                      dragging.current = null
                    }}
                    onDoubleClick={() => onOpenList(n.code)}
                    title={`${n.code} — ${n.course.title}. Double-click to see its full chain.`}
                    className={cn(
                      // Opaque, with a shadow. The cards were translucent over a
                      // grid background, so two that touched became unreadable.
                      'group absolute cursor-grab touch-none overflow-hidden rounded-lg border px-2.5 py-2 shadow-md transition-colors duration-150 active:cursor-grabbing',
                      done && trusted
                        ? 'border-success/60 bg-success/15'
                        : 'border-border-strong bg-surface hover:border-accent',
                    )}
                  >
                    <span className="flex items-center gap-1">
                      <GripVertical size={11} className="shrink-0 text-subtle" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-fg">
                        {n.code}
                      </span>
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => setNodes((prev) => prev.filter((p) => p.code !== n.code))}
                        aria-label={`Remove ${n.code}`}
                        className="shrink-0 text-subtle opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-danger"
                      >
                        <X size={12} aria-hidden />
                      </button>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted">
                      {n.course.title}
                    </span>
                    {done && trusted && (
                      <span className="mt-0.5 block text-[10px] font-medium text-success">
                        Done
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center">
              <div>
                <p className="text-[14px] font-medium text-fg">Drag a course onto the board</p>
                <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-subtle">
                  Whatever you drop brings its prerequisites in above it and what it unlocks below,
                  so one course gives you a whole chain.
                </p>
              </div>
            </div>
          )}

          {/* ── Minimap: the whole board, wherever you are in it ─────────── */}
          {nodes.length > 0 && (
            <div
              className="pointer-events-none absolute right-3 bottom-3 overflow-hidden rounded-lg border border-border bg-surface/95 shadow-lg"
              style={{ width: MINIMAP_W, height: mapH }}
              aria-hidden
            >
              {nodes.map((n) => (
                <span
                  key={n.code}
                  className={cn(
                    'absolute rounded-[1px]',
                    completed.has(normalizeCode(n.code)) && trusted ? 'bg-success' : 'bg-accent',
                  )}
                  style={{
                    left: n.x * mapScale,
                    top: n.y * mapScale,
                    width: Math.max(3, CARD_W * mapScale),
                    height: Math.max(2, CARD_H * mapScale),
                  }}
                />
              ))}
              <span
                className="absolute rounded-sm border border-fg/60"
                style={{
                  left: view.x * mapScale,
                  top: view.y * mapScale,
                  width: Math.min(MINIMAP_W, view.w * mapScale),
                  height: Math.min(mapH, view.h * mapScale),
                }}
              />
            </div>
          )}
        </div>

        {/* ── Controls ─────────────────────────────────────────────────── */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] text-subtle">
          <label className="flex items-center gap-2">
            <span className="sr-only">Zoom</span>
            <Maximize2 size={12} aria-hidden />
            <input
              type="range"
              min={MIN_ZOOM * 100}
              max={MAX_ZOOM * 100}
              step={5}
              value={Math.round(zoom * 100)}
              onChange={(e) => setZoom(Number(e.target.value) / 100)}
              aria-label="Zoom"
              className="ct-range w-28"
            />
            <span className="w-9 tabular-nums">{Math.round(zoom * 100)}%</span>
          </label>

          <span>
            {nodes.length} on the board · {edges.length} link{edges.length === 1 ? '' : 's'}
          </span>

          {pulling && (
            <span className="flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin" aria-hidden />
              Pulling in what {pulling} connects to…
            </span>
          )}

          {nodes.length > 0 && (
            <span className="ml-auto flex items-center gap-3">
              <button
                type="button"
                onClick={() => setNodes((prev) => arrange(prev))}
                className="transition-colors duration-150 hover:text-fg"
              >
                Tidy up
              </button>
              <button
                type="button"
                onClick={() => setNodes([])}
                className="inline-flex items-center gap-1 transition-colors duration-150 hover:text-danger"
              >
                <Trash2 size={11} aria-hidden />
                Clear
              </button>
            </span>
          )}
        </div>

        <p className="mt-1 text-[11px] text-subtle">
          An arrow means the calendar names the course above inside the one below. Double-click a
          card for its full chain.
        </p>
      </div>
    </div>
  )
}
