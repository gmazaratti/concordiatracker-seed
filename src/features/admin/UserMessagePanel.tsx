import { useCallback, useEffect, useState } from 'react'
import { Check, Eye, Loader2, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { when } from './user-detail-data'

interface Sent {
  id: number
  body: string
  created_at: string
  seen_at: string | null
  acknowledged_at: string | null
  reply: string | null
  replied_at: string | null
}

/**
 * Send this person a note, and see whether it landed.
 *
 * THE DELIVERY STATES ARE THE POINT. "Sent" tells you nothing you did not
 * already know. Whether it rendered on their screen, whether they pressed the
 * button, and whether they wrote back are three different facts and they are
 * the only reason to build this rather than send an email.
 *
 * Deliberately no recipient picker and no "send to all". This lives inside
 * one person's panel because it is a reply to that person; a broadcast tool
 * would be a different thing with different consequences, and every send here
 * is written to the audit log with its text.
 */
export function UserMessagePanel({ userId, name }: { userId: string; name: string | null }) {
  const [body, setBody] = useState('')
  const [rows, setRows] = useState<Sent[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const [reloads, setReloads] = useState(0)
  const reload = useCallback(() => setReloads((n) => n + 1), [])

  useEffect(() => {
    let alive = true
    void supabase.rpc('admin_messages_for', { p_user: userId }).then(({ data, error }) => {
      if (!alive) return
      // A pending migration reads as "nothing sent yet", not a broken tab.
      setRows(error ? [] : ((data ?? []) as Sent[]))
    })
    return () => {
      alive = false
    }
  }, [userId, reloads])

  async function send() {
    const text = body.trim()
    if (!text || busy) return
    setBusy(true)
    setErr('')
    const { error } = await supabase.rpc('send_admin_message', { p_to: userId, p_body: text })
    if (error) setErr(error.message)
    else {
      setBody('')
      reload()
    }
    setBusy(false)
  }

  const first = (name ?? '').split(/\s+/)[0]

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-[12.5px] font-medium text-fg">Send a message</p>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-subtle">
        Appears in the corner of their screen next time they have the app open, and stays until
        they acknowledge it. They can write back.
      </p>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder={first ? `Hi ${first} — ` : 'Write a note…'}
        aria-label="Message"
        className="mt-2 w-full resize-y rounded-md border border-border bg-canvas px-2.5 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" disabled={busy || !body.trim()} onClick={() => void send()}>
          {busy ? (
            <Loader2 size={13} className="mr-1 inline animate-spin" aria-hidden />
          ) : (
            <Send size={13} className="mr-1 inline" aria-hidden />
          )}
          Send
        </Button>
        <span className="text-[11px] text-subtle">{1000 - body.length} left</span>
      </div>
      {err && <p className="mt-2 text-[12px] text-danger">{err}</p>}

      {rows && rows.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-border pt-3">
          {rows.map((m) => (
            <li key={m.id} className="text-[12.5px]">
              <p className="leading-relaxed text-fg">{m.body}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-subtle">
                <span>{when(m.created_at)}</span>
                <Status m={m} />
              </p>
              {m.reply && (
                <p className="mt-1.5 rounded-md border-l-2 border-accent bg-surface-2 px-2.5 py-1.5 text-[12.5px] leading-relaxed text-fg">
                  {m.reply}
                  <span className="mt-0.5 block text-[10.5px] text-subtle">
                    {name ?? 'They'} replied {when(m.replied_at)}
                  </span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Three states, because "sent" is not one of the interesting ones. */
function Status({ m }: { m: Sent }) {
  if (m.acknowledged_at) {
    return (
      <span className="inline-flex items-center gap-1 text-success">
        <Check size={11} aria-hidden />
        Read {when(m.acknowledged_at)}
      </span>
    )
  }
  if (m.seen_at) {
    return (
      <span className="inline-flex items-center gap-1 text-warning">
        <Eye size={11} aria-hidden />
        On their screen, not acknowledged
      </span>
    )
  }
  return <span className="text-subtle">Waiting — they have not opened the app since</span>
}
