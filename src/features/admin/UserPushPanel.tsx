import { useEffect, useState } from 'react'
import { BellOff, BellRing, Loader2, MonitorSmartphone, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { adminUserPush, deviceLabel, sendAdminPush, type UserPush } from '@/lib/admin-push'
import { when } from './user-detail-data'

/**
 * Push notifications for one person: whether they turned them on and on which
 * devices, every push we sent them with whether they OPENED it, and a box to
 * send one more.
 *
 * "Opened" means they followed the push into the app (the link carries a log
 * id; app/PushOpenTracker marks it). A push someone read on their lock screen
 * and swiped away counts as not opened, so this is a lower bound.
 */
export function UserPushPanel({ userId }: { userId: string }) {
  const [data, setData] = useState<UserPush | null>(null)
  const [tick, setTick] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [link, setLink] = useState('/app')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    let alive = true
    void adminUserPush(userId)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData({ devices: [], pushes: [] }))
    return () => {
      alive = false
    }
  }, [userId, tick])

  async function send() {
    setBusy(true)
    setNote('')
    try {
      const [r] = await sendAdminPush([userId], title.trim(), body.trim(), link.trim() || '/app')
      setNote(r && r.delivered > 0 ? `Delivered to ${r.delivered} device${r.delivered === 1 ? '' : 's'}.` : 'Not delivered: no device took it.')
      setTitle('')
      setBody('')
      setTick((n) => n + 1)
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'That did not send.')
    }
    setBusy(false)
  }

  const on = (data?.devices.length ?? 0) > 0
  const sent = data?.pushes.filter((p) => p.delivered > 0) ?? []
  const opened = sent.filter((p) => p.opened_at).length
  const field = 'w-full rounded-md border border-border bg-canvas px-2.5 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg">
        <BellRing size={13} className="text-accent" aria-hidden /> Push notifications
      </p>
      {!data ? (
        <Loader2 size={14} className="mt-2 animate-spin text-subtle" aria-hidden />
      ) : (
        <>
          <p className={`mt-1 flex items-center gap-1.5 text-[12px] ${on ? 'text-success' : 'text-subtle'}`}>
            {on ? <BellRing size={12} aria-hidden /> : <BellOff size={12} aria-hidden />}
            {on ? `On, ${data.devices.length} device${data.devices.length === 1 ? '' : 's'}` : 'Not turned on on any device'}
          </p>
          {on && (
            <ul className="mt-1.5 space-y-1">
              {data.devices.map((d, i) => (
                <li key={i} className="flex items-center gap-1.5 text-[11.5px] text-muted">
                  <MonitorSmartphone size={12} className="shrink-0 text-subtle" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{deviceLabel(d)}</span>
                  <span className="shrink-0 text-subtle">since {when(d.created_at)}</span>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-[11.5px] text-subtle">
            {sent.length === 0
              ? 'No pushes sent from here yet.'
              : `Opened ${opened} of ${sent.length} delivered (${Math.round((opened / sent.length) * 100)}%).`}
          </p>
          {data.pushes.length > 0 && (
            <ul className="mt-1.5 max-h-48 space-y-1.5 overflow-y-auto">
              {data.pushes.map((p) => (
                <li key={p.id} className="rounded-md bg-canvas px-2.5 py-1.5 text-[12px]">
                  <p className="truncate font-medium text-fg">{p.title}</p>
                  <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-subtle">
                    <span>{when(p.sent_at)}</span>
                    <span className={p.opened_at ? 'text-success' : p.delivered > 0 ? '' : 'text-warning'}>
                      {p.opened_at ? `Opened ${when(p.opened_at)}` : p.delivered > 0 ? 'Delivered, not opened' : 'Not delivered'}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 space-y-2 border-t border-border pt-3">
            <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Push title" className={field} />
            <input value={body} maxLength={240} onChange={(e) => setBody(e.target.value)} placeholder="Message (optional)" aria-label="Push message" className={field} />
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/app" aria-label="Opens" className={field} />
            <div className="flex items-center gap-2">
              <Button size="sm" disabled={busy || !title.trim() || !on} onClick={() => void send()}>
                {busy ? <Loader2 size={13} className="mr-1 inline animate-spin" aria-hidden /> : <Send size={13} className="mr-1 inline" aria-hidden />}
                Send push
              </Button>
              {!on && <span className="text-[11px] text-subtle">They have no device to send to.</span>}
            </div>
            {note && <p className="text-[12px] text-muted">{note}</p>}
          </div>
        </>
      )}
    </div>
  )
}
