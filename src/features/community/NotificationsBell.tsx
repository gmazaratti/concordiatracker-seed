import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useFollows } from '@/app/providers/follows'
import { recentEventsFromOrgs, postedAgoLabel } from '@/data/community'
import { startOfToday } from '@/lib/date'
import { OrgLogo } from './OrgLogo'

/** Notifications panel — a UI SHELL. Items are mocked from the orgs you follow
 * ("‹Org› posted a new event"). CONNECTION-PHASE: real notification generation +
 * delivery (and follow persistence) need a multi-user backend; this just reshapes
 * the single-user mock so the interaction is demonstrable. */
export function NotificationsBell({ onOpenEvent }: { onOpenEvent: (id: string) => void }) {
  const { followedHandles } = useFollows()
  const [open, setOpen] = useState(false)
  const [seenCount, setSeenCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const items = recentEventsFromOrgs(followedHandles, startOfToday())
  const unread = items.length > seenCount

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggle() {
    setOpen((o) => {
      const next = !o
      if (next) setSeenCount(items.length) // opening clears the unread dot
      return next
    })
  }

  function pick(id: string) {
    setOpen(false)
    onOpenEvent(id)
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        aria-label={`Notifications${unread ? ' (unread)' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative grid size-9 place-items-center rounded-lg border border-border bg-surface text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
      >
        <Bell size={17} aria-hidden />
        {unread && (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-accent ring-2 ring-surface" aria-hidden />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="ct-animate-pop absolute right-0 z-30 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface p-1.5 shadow-2xl"
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-[13px] font-semibold text-fg">Notifications</span>
            <span className="text-[11px] text-subtle">From orgs you follow</span>
          </div>

          {items.length === 0 ? (
            <p className="px-2 py-6 text-center text-[12px] text-subtle">
              Follow organizations to get notified when they post events.
            </p>
          ) : (
            <ul>
              {items.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => pick(e.id)}
                    className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
                  >
                    <OrgLogo org={e.org} className="mt-0.5 size-8" rounded="rounded-md" textClass="text-[10px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] leading-snug text-fg">
                        <span className="font-semibold">{e.org.name}</span> posted a new event
                      </span>
                      <span className="block truncate text-[12px] text-muted">{e.title}</span>
                      <span className="block text-[11px] text-subtle">{postedAgoLabel(e.postedDaysAgo)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-1 border-t border-border px-2 pt-1.5 pb-0.5 text-[10px] text-subtle">
            Demo — notifications are mocked from your follows.
          </p>
        </div>
      )}
    </div>
  )
}
