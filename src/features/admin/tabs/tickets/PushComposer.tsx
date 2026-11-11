import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BellRing, X } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { adminPushStats, sendAdminPush, type PushResult, type PushStats } from '@/lib/admin-push'
import { findUsers, type FoundUser } from '@/features/admin/invites/club-invites'

type Result = PushResult

/**
 * Send a custom push notification to people you pick (api/admin.ts, push).
 * Only reaches phones and browsers that turned notifications on; the result
 * says, per person, how many devices got it, so "sent" never hides "nobody
 * had notifications on". Every send is audit-logged with its text.
 */
export function PushComposer({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const [found, setFound] = useState<FoundUser[]>([])
  const [picked, setPicked] = useState<FoundUser[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [link, setLink] = useState('/app')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<Result[] | null>(null)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<PushStats | null>(null)
  useEffect(() => {
    void adminPushStats().then(setStats)
  }, [])

  useEffect(() => {
    let alive = true
    const id = window.setTimeout(() => {
      void (q.trim().length >= 2 ? findUsers(q.trim().replace(/^@/, '')) : Promise.resolve([])).then(
        (r) => alive && setFound(r),
      )
    }, 220)
    return () => {
      alive = false
      window.clearTimeout(id)
    }
  }, [q])

  async function send() {
    setBusy(true)
    setError('')
    try {
      setResults(await sendAdminPush(picked.map((p) => p.user_id), title, body, link))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not send.')
    }
    setBusy(false)
  }

  const nameOf = (id: string) => {
    const u = picked.find((p) => p.user_id === id)
    return u?.name ?? (u?.handle ? `@${u.handle}` : 'Someone')
  }
  const field = 'w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13px] text-fg outline-none focus:border-accent'

  return createPortal(
    <ModalShell label="Send a push notification" onClose={onClose}>
      <div className="max-h-[85dvh] overflow-y-auto p-5">
        <h2 className="flex items-center gap-2 text-[17px] font-bold text-fg">
          <BellRing size={16} className="text-accent" aria-hidden /> Send a push notification
        </h2>
        <p className="mt-1 text-[12.5px] text-subtle">
          Goes to the phones and browsers of the people you pick, if they turned notifications on. Logged with its text.
        </p>
        {stats && stats.sent > 0 && (
          <div className="mt-3 rounded-lg border border-border bg-canvas px-3 py-2 text-[12px]">
            <p className="text-fg">
              Opened {stats.opened} of {stats.sent} delivered ({Math.round((stats.opened / stats.sent) * 100)}%).{' '}
              <span className="text-subtle">{stats.with_devices} people have notifications on.</span>
            </p>
            <ul className="mt-1.5 max-h-28 space-y-0.5 overflow-y-auto text-[11.5px] text-subtle">
              {stats.sends.map((x, i) => (
                <li key={i} className="flex gap-2">
                  <span className="min-w-0 flex-1 truncate text-muted">{x.title}</span>
                  <span className="shrink-0">
                    {x.opened}/{x.delivered} opened
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {results ? (
          <div className="mt-4">
            <ul className="space-y-1.5">
              {results.map((r) => (
                <li key={r.userId} className="flex justify-between rounded-lg border border-border bg-canvas px-3 py-2 text-[13px]">
                  <span className="text-fg">{nameOf(r.userId)}</span>
                  <span className={r.delivered > 0 ? 'text-success' : 'text-subtle'}>
                    {r.delivered > 0
                      ? `Delivered to ${r.delivered} device${r.delivered === 1 ? '' : 's'}`
                      : r.devices === 0
                        ? 'Notifications not turned on'
                        : 'Not delivered'}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={onClose} className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-accent-contrast">
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <label className="mt-4 block text-[12px] font-medium text-muted">Send to</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {picked.map((u) => (
                <span key={u.user_id} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] text-fg">
                  {u.name ?? u.handle}
                  <button type="button" aria-label={`Remove ${u.name ?? u.handle}`} onClick={() => setPicked((p) => p.filter((x) => x.user_id !== u.user_id))}>
                    <X size={12} aria-hidden />
                  </button>
                </span>
              ))}
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, @handle or email" className={`${field} mt-1.5`} />
            {found.length > 0 && (
              <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-border">
                {found
                  .filter((u) => !picked.some((p) => p.user_id === u.user_id))
                  .map((u) => (
                    <li key={u.user_id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPicked((p) => [...p, u])
                          setQ('')
                        }}
                        className="w-full px-3 py-2 text-left text-[12.5px] hover:bg-surface-2"
                      >
                        <span className="font-medium text-fg">{u.name ?? 'No name'}</span>{' '}
                        <span className="text-subtle">
                          {u.handle ? `@${u.handle}` : ''} {u.email}
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            )}

            <label className="mt-4 block text-[12px] font-medium text-muted">Title</label>
            <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} className={`${field} mt-1`} />
            <label className="mt-3 block text-[12px] font-medium text-muted">Message (optional)</label>
            <textarea value={body} maxLength={240} rows={3} onChange={(e) => setBody(e.target.value)} className={`${field} mt-1 resize-none`} />
            <label className="mt-3 block text-[12px] font-medium text-muted">Opens (a page in the app)</label>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/app" className={`${field} mt-1`} />
            {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-[13px] text-muted hover:text-fg">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || picked.length === 0 || !title.trim()}
                onClick={() => void send()}
                className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-accent-contrast disabled:opacity-40"
              >
                {busy ? 'Sending' : `Send to ${picked.length || ''}`.trim()}
              </button>
            </div>
          </>
        )}
      </div>
    </ModalShell>,
    document.body,
  )
}
