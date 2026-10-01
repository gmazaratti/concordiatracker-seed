import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { LIBRARY_HOURS_URL, montrealDay, parseLibraryHours, type LibraryToday } from '@/lib/library-hours'
import { WidgetCard, WidgetEmpty } from './WidgetCard'

/**
 * Today's hours at Webster and Vanier.
 *
 * Read from the library's own calendar straight from the browser (it is
 * keyless and CORS-open) and kept until Montreal's date changes, so it is one
 * request per device per day and nothing on our server. "Open now" is
 * recomputed by the library's feed, so it is only as fresh as that day's fetch;
 * the hours are the reliable part and lead.
 */
const KEY = 'ct_library_hours'

function readCache(): LibraryToday[] | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { day: string; libraries: LibraryToday[] }
    return v.day === montrealDay(new Date()) ? v.libraries : null
  } catch {
    return null
  }
}

export function LibraryHoursWidget() {
  const [libraries, setLibraries] = useState<LibraryToday[] | null>(() => readCache())
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (readCache()) return
    let live = true
    fetch(LIBRARY_HOURS_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json) => {
        const parsed = parseLibraryHours(json)
        if (!live) return
        if (parsed.length === 0) {
          setFailed(true)
          return
        }
        try {
          localStorage.setItem(KEY, JSON.stringify({ day: montrealDay(new Date()), libraries: parsed }))
        } catch {
          /* private mode */
        }
        setLibraries(parsed)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [])

  return (
    <WidgetCard title="Library hours" icon={Clock}>
      {!libraries ? (
        <WidgetEmpty>{failed ? 'The library calendar is not answering right now.' : 'Loading today’s hours…'}</WidgetEmpty>
      ) : (
        <ul className="divide-y divide-border/60">
          {libraries.map((l) => (
            <li key={l.id} className="flex items-baseline gap-3 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] text-fg">
                  {l.name}
                  {l.campus && <span className="text-subtle"> · {l.campus}</span>}
                </p>
                {l.desk?.hours && (
                  <p className="truncate text-[11px] text-subtle">
                    {l.desk.name}: {l.desk.hours}
                  </p>
                )}
              </div>
              <span
                className={cn(
                  'shrink-0 text-[12.5px] font-semibold tabular-nums',
                  l.hours === 'Closed' ? 'text-subtle' : 'text-fg',
                )}
              >
                {l.hours ?? 'Not posted'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  )
}
