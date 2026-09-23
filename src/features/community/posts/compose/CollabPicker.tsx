import { useEffect, useRef, useState } from 'react'
import { Search, UserPlus, X } from 'lucide-react'
import { searchOrgsToInvite, type OrgOption } from '@/lib/collab'
import type { PublishableOrg } from '../../useMyOrgs'

/**
 * "Invite collaborator" and the search behind it.
 *
 * AN INLINE PANEL, NOT A SECOND SHEET. The composer is already a bottom sheet
 * on a phone; stacking another one over it means two grabbers, two dismiss
 * gestures and a back stack for choosing one name. It expands in place and
 * collapses when you pick.
 *
 * WHAT IT SHOWS: logo, handle, name — the three things that tell two clubs
 * with similar names apart. An empty query lists approved organisations
 * alphabetically rather than nothing, because most people are looking for one
 * of a handful they already work with and should not have to guess its
 * spelling to see it.
 *
 * EVERY ROW HERE IS "PENDING". Nothing is sent until the post exists, and the
 * chip says so — a club that has not been asked yet must not read as one that
 * has said yes.
 */
export function CollabPicker({
  org,
  invitees,
  open,
  onOpen,
  onClose,
  onAdd,
  onRemove,
}: {
  org: PublishableOrg
  invitees: OrgOption[]
  open: boolean
  onOpen: () => void
  onClose: () => void
  onAdd: (o: OrgOption) => void
  onRemove: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<OrgOption[] | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    // Debounced, and the setState lives in the timer rather than the effect
    // body — react-hooks/set-state-in-effect, the same shape SearchOverlay uses.
    const id = window.setTimeout(
      () => {
        void searchOrgsToInvite(q, org.id).then((r) => alive && setRows(r))
      },
      q ? 200 : 0,
    )
    return () => {
      alive = false
      window.clearTimeout(id)
    }
  }, [q, open, org.id])

  const already = new Set(invitees.map((i) => i.id))
  // It opens INLINE, at the bottom of a scrolling sheet — on a phone that is
  // below the fold, so a tap looked like it did nothing. Bring it into view.
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open) box.current?.scrollIntoView({ block: 'nearest' })
  }, [open])

  return (
    <div ref={box} className="mt-3 scroll-mb-4">
      {invitees.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {invitees.map((o) => (
            <li
              key={o.id}
              className="flex items-center gap-1.5 rounded-full bg-surface-2 py-1 pr-1 pl-2.5 text-[12px] text-fg"
            >
              <span className="font-medium">{o.handle.replace(/^@/, '')}</span>
              <span className="text-subtle">· pending</span>
              <button
                type="button"
                onClick={() => onRemove(o.id)}
                aria-label={`Do not invite ${o.handle}`}
                className="grid size-5 place-items-center rounded-full text-subtle transition-colors duration-150 hover:bg-surface hover:text-fg"
              >
                <X size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!open ? (
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-medium text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
        >
          <UserPlus size={14} aria-hidden />
          Invite collaborator
        </button>
      ) : (
        <div className="rounded-xl border border-border bg-canvas p-2">
          <div className="relative">
            <Search
              size={14}
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-subtle"
            />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search clubs by name or handle"
              aria-label="Search organisations to invite"
              className="w-full rounded-lg bg-surface-2 py-2 pr-8 pl-8 text-[13px] text-fg placeholder:text-subtle focus:outline-none"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-full text-subtle hover:text-fg"
            >
              <X size={13} aria-hidden />
            </button>
          </div>
          <ul className="mt-1 max-h-56 overflow-y-auto">
            {rows === null ? (
              <li className="px-2 py-4 text-center text-[12.5px] text-subtle">Loading…</li>
            ) : rows.length === 0 ? (
              <li className="px-2 py-4 text-center text-[12.5px] text-subtle">
                {q.trim() ? `No club matching “${q.trim()}”.` : 'No other approved clubs yet.'}
              </li>
            ) : (
              rows.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    disabled={already.has(o.id)}
                    onClick={() => onAdd(o)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-2 text-left transition-colors duration-150 hover:bg-surface-2 disabled:opacity-40"
                  >
                    {o.logo ? (
                      <img src={o.logo} alt="" className="size-8 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span
                        className="grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white"
                        style={{ background: o.color ?? '#4b5563' }}
                      >
                        {(o.glyph || o.name.slice(0, 2)).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-fg">
                        {o.handle.replace(/^@/, '')}
                      </span>
                      <span className="block truncate text-[11.5px] text-subtle">{o.name}</span>
                    </span>
                    {already.has(o.id) && <span className="text-[11.5px] text-subtle">Added</span>}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
