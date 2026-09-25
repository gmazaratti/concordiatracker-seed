import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { activityHref } from './sections'
import { Bell, X } from 'lucide-react'
import { listNotifications, type AppNotification } from '@/lib/notifications'
import { cn } from '@/lib/cn'

/** Shown once per browser session. A toast that reappears on every navigation
 *  stops being news and becomes furniture you learn to click away. */
const SEEN_KEY = 'ct_notif_toast_seen'

function alreadyShown(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}
function markShown() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* private window, blocked storage — showing it twice is not a failure */
  }
}

/**
 * "Something happened while you were away."
 *
 * The bell is where notifications LIVE; this exists because nobody opens a
 * bell they have no reason to suspect is full. It appears once per session,
 * says what the newest thing was, and gets out of the way.
 *
 * IT DOES NOT MARK ANYTHING READ. Seeing a toast is not reading your
 * notifications — the panel does that when you open it. Dismissing this
 * leaves the count exactly where it was, which is the same rule the update
 * toast follows: not missed just because the toast is gone.
 */
export function NotificationToast() {
  const navigate = useNavigate()
  const location = useLocation()
  const [newest, setNewest] = useState<AppNotification | null>(null)
  const [count, setCount] = useState(0)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (alreadyShown()) return
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    void (async () => {
      const rows = await listNotifications(20)
      if (!alive) return
      const unread = rows.filter((r) => !r.read_at)
      if (unread.length === 0) return
      markShown()
      setNewest(unread[0])
      setCount(unread.length)
      // A plain timer, not an animation end: how long this stays has nothing
      // to do with whether the entrance played.
      timer = setTimeout(() => alive && setGone(true), 7000)
    })()
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
  }, [])

  if (!newest || gone) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'ct-animate-pop fixed right-4 bottom-20 z-[70] flex max-w-[min(22rem,calc(100vw-2rem))] items-start gap-3',
        'rounded-xl border border-border bg-surface px-3.5 py-3 shadow-2xl md:bottom-4',
      )}
    >
      <button
        type="button"
        onClick={() => {
          setGone(true)
          navigate(activityHref(location.pathname, location.search))
        }}
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
      >
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <Bell size={15} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-fg">{newest.title}</span>
          <span className="mt-0.5 block text-[11.5px] text-subtle">
            {count > 1 ? `${count} new notifications` : 'Tap to see it'}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => setGone(true)}
        aria-label="Dismiss"
        className="mt-0.5 shrink-0 rounded-md p-1 text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
      >
        <X size={15} aria-hidden />
      </button>
    </div>
  )
}
