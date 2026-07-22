import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, X } from 'lucide-react'
import { adminActivityFeed, useIsAdmin, type ActivityFeed, type ActivityKind } from './admin-data'

type Item = ActivityFeed['items'][number]

const POLL_MS = 90_000
const DISMISS_MS = 8_000

const HREF: Record<ActivityKind, string> = {
  user: '/admin?tab=users',
  feature: '/feedback',
  bug: '/admin?tab=bugs',
  request: '/admin?tab=applications',
  org: '/admin?tab=applications',
  teacher: '/admin?tab=applications',
}

/** Admin-only live toaster: polls the activity feed and pops a toast the moment
 * something new lands — a portal signup, an access request, feedback, a new
 * user — while you're anywhere in the app. Click-through to the right admin
 * tab. First fetch sets the watermark, so loading the app never toast-floods. */
export function AdminActivityToaster() {
  const { isAdmin } = useIsAdmin()
  const navigate = useNavigate()
  const [toast, setToast] = useState<{ item: Item; extra: number } | null>(null)
  const watermark = useRef<number | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    let active = true
    const tick = async () => {
      try {
        const feed = await adminActivityFeed()
        if (!active || !feed || feed.items.length === 0) return
        const newest = feed.items.reduce(
          (m, i) => Math.max(m, new Date(i.created_at).getTime()),
          0,
        )
        if (watermark.current === null) {
          watermark.current = newest
          return
        }
        const mark = watermark.current
        const fresh = feed.items.filter((i) => new Date(i.created_at).getTime() > mark)
        if (fresh.length > 0) {
          watermark.current = newest
          setToast({ item: fresh[0], extra: fresh.length - 1 })
        }
      } catch {
        /* transient — next poll retries */
      }
    }
    void tick()
    const id = setInterval(() => void tick(), POLL_MS)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [isAdmin])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), DISMISS_MS)
    return () => clearTimeout(t)
  }, [toast])

  if (!isAdmin || !toast) return null
  const { item, extra } = toast

  return (
    <div
      role="status"
      aria-live="polite"
      className="ct-animate-pop fixed right-4 bottom-20 z-50 w-[320px] max-w-[calc(100vw-2rem)] md:bottom-4"
    >
      <div className="flex items-start gap-3 rounded-xl border border-accent/40 bg-surface p-3.5 shadow-[var(--ct-shadow)]">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          <Bell size={15} aria-hidden />
        </span>
        <button
          type="button"
          onClick={() => {
            setToast(null)
            navigate(HREF[item.kind])
          }}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block truncate text-[13px] font-semibold text-fg">{item.title}</span>
          <span className="block truncate text-[12px] text-subtle">
            {item.subtitle}
            {extra > 0 && ` · +${extra} more`}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setToast(null)}
          aria-label="Dismiss"
          className="grid size-6 shrink-0 place-items-center rounded text-subtle transition-colors hover:text-fg"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
    </div>
  )
}
