import { useEffect, useState } from 'react'
import type { Course } from '@/data/types'
import { CourseChip } from '@/components/CourseChip'
import { cn } from '@/lib/cn'
import { searchNotes, type SearchHit } from './notes-api'

/**
 * Full-text results across every note. The database marks the matched words
 * with << >> in the snippet; they are split here and rendered as <mark>, so
 * nothing from a note is ever interpreted as markup.
 */
export function SearchResults({
  query,
  courses,
  selectedId,
  onSelect,
}: {
  query: string
  courses: Course[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      searchNotes(query)
        .then((h) => {
          if (!cancelled) {
            setHits(h)
            setFailed(false)
          }
        })
        .catch(() => !cancelled && setFailed(true))
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  if (failed) return <p className="p-4 text-[13px] text-danger">Search is unavailable right now.</p>
  if (!hits) return <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <div key={i} className="ct-shimmer h-14 rounded-lg" />)}</div>
  if (hits.length === 0) return <p className="p-4 text-[13px] text-subtle">No notes match “{query}”.</p>

  const courseById = new Map(courses.map((c) => [c.id, c]))
  return (
    <ul className="flex flex-col gap-0.5 p-2">
      {hits.map((h) => {
        const c = h.courseId ? courseById.get(h.courseId) : undefined
        return (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => onSelect(h.id)}
              className={cn(
                'flex w-full flex-col gap-1 rounded-lg px-2.5 py-2 text-left',
                h.id === selectedId ? 'bg-accent-soft' : 'hover:bg-surface-2',
              )}
            >
              <span className="flex items-center gap-2">
                <span className="truncate text-[13.5px] font-medium text-fg">{h.title || 'Untitled note'}</span>
                {c && <CourseChip code={c.code} color={c.color} />}
              </span>
              {h.snippet && <Snippet text={h.snippet} />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function Snippet({ text }: { text: string }) {
  const parts = text.split(/(<<.*?>>)/g)
  return (
    <span className="line-clamp-2 text-[12.5px] leading-snug text-muted">
      {parts.map((p, i) =>
        p.startsWith('<<') && p.endsWith('>>') ? (
          <mark key={i} className="rounded bg-accent-soft px-0.5 text-fg">
            {p.slice(2, -2)}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  )
}
