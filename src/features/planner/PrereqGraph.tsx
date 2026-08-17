import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GripVertical, Loader2, Search, Trash2, X } from 'lucide-react'
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

/**
 * The prerequisite map as a board you build.
 *
 * A library on the left, a canvas on the right, and an arrow drawn between any
 * two cards where one is a prerequisite of the other. The arrows are NOT
 * decoration and NOT guessed: they come from the same extracted codes the rest
 * of the planner reads, so a line means Concordia's calendar names that course
 * in the other's prerequisite. Where the calendar's wording is a rule we cannot
 * parse ("18 credits in the programme"), no line is drawn rather than a wrong
 * one — the same rule the list view follows.
 *
 * Dropping a course also pulls in what it needs and what it opens, so one drag
 * gives you a chain rather than a lone card. That is the whole point of the
 * board: you are not laying out a diagram, you are asking "if I take this, what
 * does it get me".
 */

const CARD_W = 168
const CARD_H = 62
/** Where a fresh drop lands if it is dropped outside the canvas. */
const FALLBACK = { x: 40, y: 40 }

interface Node {
  code: string
  course: CatalogCourse
  x: number
  y: number
}

const codeOf = (c: CatalogCourse) => `${c.subject} ${c.catalog}`

export function PrereqGraph({
  completed,
  trusted,
}: {
  completed: Set<string>
  trusted: boolean
}) {
  const [nodes, setNodes] = useState<Node[]>([])
  const [query, setQuery] = useState('')
  const [library, setLibrary] = useState<CatalogCourse[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [pulling, setPulling] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<{ code: string; dx: number; dy: number } | null>(null)

  // The library is never empty: without a search it shows the subjects the
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

  /** Place a course, then fetch its neighbours and lay them out around it. */
  const add = useCallback(
    async (course: CatalogCourse, at?: { x: number; y: number }) => {
      const code = codeOf(course)
      const origin = at ?? FALLBACK
      let already = false
      setNodes((prev) => {
        already = prev.some((n) => n.code === code)
        return already ? prev : [...prev, { code, course, x: origin.x, y: origin.y }]
      })
      if (already) return

      setPulling(code)
      const needs = extractCourseCodes(course.prerequisites)
      const [parents, children] = await Promise.all([
        needs.length ? coursesByCodes(needs).catch(() => []) : Promise.resolve([]),
        unlockedBy(code, 6).catch(() => []),
      ])
      setPulling(null)

      // Prerequisites above, what it unlocks below — the direction everybody
      // already reads a family tree in.
      setNodes((prev) => {
        const have = new Set(prev.map((n) => n.code))
        const placed: Node[] = [...prev]
        const row = (list: CatalogCourse[], dy: number) =>
          list.forEach((c, i) => {
            const key = codeOf(c)
            if (have.has(key)) return
            have.add(key)
            placed.push({
              code: key,
              course: c,
              x: Math.max(8, origin.x + (i - (list.length - 1) / 2) * (CARD_W + 22)),
              y: Math.max(8, origin.y + dy),
            })
          })
        row(parents, -(CARD_H + 54))
        row(children.slice(0, 4), CARD_H + 54)
        return placed
      })
    },
    [],
  )

  /** Every arrow that both ends of are actually on the board. */
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

  function pointIn(e: { clientX: number; clientY: number }) {
    const box = canvasRef.current?.getBoundingClientRect()
    if (!box) return FALLBACK
    return {
      x: Math.max(8, e.clientX - box.left + (canvasRef.current?.scrollLeft ?? 0) - CARD_W / 2),
      y: Math.max(8, e.clientY - box.top + (canvasRef.current?.scrollTop ?? 0) - CARD_H / 2),
    }
  }

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100svh-260px)] lg:min-h-[520px] lg:flex-row">
      {/* ── Library ─────────────────────────────────────────────────────── */}
      <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-surface lg:w-[300px] lg:shrink-0">
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
          <p className="mt-1.5 text-[11px] text-subtle">
            Drag onto the board, or click to drop one in.
          </p>
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
                      draggable
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
                      {/* The description is what tells two similar codes apart,
                          so it belongs in the list, not behind an expand. */}
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
      <div className="relative min-w-0 flex-1">
        <div
          ref={canvasRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const raw = e.dataTransfer.getData('text/ct-course')
            if (!raw) return
            void add(JSON.parse(raw) as CatalogCourse, pointIn(e))
          }}
          className="ct-grid-bg relative h-[60svh] overflow-auto rounded-xl border border-border bg-canvas lg:h-full"
        >
          {/* Arrows sit under the cards and are sized to the scrollable area,
              so they stay attached when the board is panned. */}
          <svg className="pointer-events-none absolute inset-0 size-full min-h-full min-w-full">
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
                y2={to.y}
                className="stroke-border-strong"
                strokeWidth={1.5}
                markerEnd="url(#ct-arrow)"
              />
            ))}
          </svg>

          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center">
              <div>
                <p className="text-[14px] font-medium text-fg">Drag a course onto the board</p>
                <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-subtle">
                  Whatever you drop brings its prerequisites in above it and what it unlocks
                  below, so you can see a whole chain from one course.
                </p>
              </div>
            </div>
          )}

          {nodes.map((n) => {
            const done = completed.has(normalizeCode(n.code))
            return (
              <div
                key={n.code}
                style={{ left: n.x, top: n.y, width: CARD_W }}
                onPointerDown={(e) => {
                  if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
                  e.currentTarget.setPointerCapture(e.pointerId)
                  dragging.current = {
                    code: n.code,
                    dx: e.clientX - n.x,
                    dy: e.clientY - n.y,
                  }
                }}
                onPointerMove={(e) => {
                  const d = dragging.current
                  if (d?.code !== n.code) return
                  const x = Math.max(0, e.clientX - d.dx)
                  const y = Math.max(0, e.clientY - d.dy)
                  setNodes((prev) => prev.map((p) => (p.code === n.code ? { ...p, x, y } : p)))
                }}
                onPointerUp={() => {
                  dragging.current = null
                }}
                className={cn(
                  'group absolute cursor-grab touch-none rounded-lg border px-2 py-1.5 shadow-sm transition-colors duration-150 active:cursor-grabbing',
                  // Green only when the record is trustworthy. Telling somebody
                  // they have not done a course they finished two years ago is
                  // worse than saying nothing.
                  done && trusted
                    ? 'border-success/50 bg-success/10'
                    : 'border-border bg-surface hover:border-accent',
                )}
              >
                <span className="flex items-center gap-1">
                  <GripVertical size={11} className="shrink-0 text-subtle" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-fg">
                    {n.code}
                  </span>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setNodes((prev) => prev.filter((p) => p.code !== n.code))}
                    aria-label={`Remove ${n.code}`}
                    className="shrink-0 text-subtle opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-danger"
                  >
                    <X size={11} aria-hidden />
                  </button>
                </span>
                <span className="mt-0.5 block truncate text-[10.5px] text-subtle">
                  {n.course.title}
                </span>
                {done && trusted && (
                  <span className="mt-0.5 block text-[10px] font-medium text-success">Done</span>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-subtle">
          <span>
            {nodes.length} on the board · {edges.length} link{edges.length === 1 ? '' : 's'}
          </span>
          {pulling && (
            <span className="flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin" aria-hidden />
              Pulling in what {pulling} connects to…
            </span>
          )}
          <span>An arrow means the calendar names the course above in the one below.</span>
          {nodes.length > 0 && (
            <button
              type="button"
              onClick={() => setNodes([])}
              className="ml-auto inline-flex items-center gap-1 text-subtle transition-colors duration-150 hover:text-danger"
            >
              <Trash2 size={11} aria-hidden />
              Clear board
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
