import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Heart, X } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { supabase } from '@/lib/supabase'
import { findUsers, type FoundUser } from '@/features/admin/invites/club-invites'

/** Starting text. {name} becomes each person's first name. */
const OUTREACH_DEFAULT = {
  subject: 'A personal thank you, {name}',
  title: 'Thank you, {name}',
  body: `Hi {name},

This is Alex, the founder of ConcordiaTracker. This note is written to you personally, not sent to everyone: you are one of the people who use the app the most, and that means a lot.

Two quick questions, if you have a minute:
1. What do you use most, and what is the one thing that annoys you?
2. What would you add if you could?

I would also love to hear more in a short call (15 minutes, whenever suits you). Would you be up for it?

As a top user, anything you ask for goes to the front of the line.

Thank you for sticking with it,
Alex`,
}

async function email(ticketId: string): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const jwt = data.session?.access_token
  if (!jwt) return
  await fetch('/api/ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ action: 'notify', ticketId }),
  }).catch(() => {})
}

/**
 * A personal note to one or more students (db/personal_outreach.sql): opens a
 * support ticket on each account, emails them, and queues a one-time
 * full-screen popup for their next visit. Their answer comes back on the
 * ticket, and the reply alert tells you.
 */
export function PersonalMessage({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const [q, setQ] = useState('')
  const [found, setFound] = useState<FoundUser[]>([])
  const [picked, setPicked] = useState<FoundUser[]>([])
  const [subject, setSubject] = useState(OUTREACH_DEFAULT.subject)
  const [title, setTitle] = useState(OUTREACH_DEFAULT.title)
  const [body, setBody] = useState(OUTREACH_DEFAULT.body)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

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
    const done: string[] = []
    const failed: string[] = []
    for (const u of picked) {
      const { data, error } = await supabase.rpc('admin_send_personal', {
        p_user: u.user_id,
        p_subject: subject,
        p_message: body,
        p_popup_title: title,
        p_popup_body: body,
      })
      const row = Array.isArray(data) ? (data[0] as { ticket_id: string; case_id: string } | undefined) : undefined
      if (error || !row) failed.push(u.name ?? u.handle ?? 'someone')
      else {
        await email(row.ticket_id)
        done.push(`${u.name ?? u.handle} (${row.case_id})`)
      }
    }
    setBusy(false)
    setResult(
      [done.length ? `Sent to ${done.join(', ')}.` : '', failed.length ? `Failed for ${failed.join(', ')}.` : '']
        .filter(Boolean)
        .join(' '),
    )
    if (done.length) onSent()
  }

  const field =
    'w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13px] text-fg outline-none focus:border-accent'

  return createPortal(
    <ModalShell label="Personal message" onClose={onClose}>
      <div className="max-h-[85dvh] overflow-y-auto p-5">
        <h2 className="flex items-center gap-2 text-[17px] font-bold text-fg">
          <Heart size={16} className="text-accent" aria-hidden /> Personal message
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-subtle">
          Opens a support ticket on each account, emails them, and shows the note full screen the next time they
          open the app (it cannot be closed for 5 seconds). {'{name}'} becomes their first name.
        </p>

        <label className="mt-4 block text-[12px] font-medium text-muted">Send to</label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {picked.map((u) => (
            <span key={u.user_id} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] text-fg">
              {u.name ?? u.handle}
              <button type="button" aria-label={`Remove ${u.name}`} onClick={() => setPicked((p) => p.filter((x) => x.user_id !== u.user_id))}>
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

        <label className="mt-4 block text-[12px] font-medium text-muted">Ticket and email subject</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className={`${field} mt-1`} />
        <label className="mt-3 block text-[12px] font-medium text-muted">Popup headline</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${field} mt-1`} />
        <label className="mt-3 block text-[12px] font-medium text-muted">Message</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} className={`${field} mt-1 resize-y leading-relaxed`} />

        {result && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-success/10 px-3 py-2 text-[12.5px] text-fg">
            <Check size={14} className="mt-0.5 shrink-0 text-success" aria-hidden /> {result}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-[13px] text-muted hover:text-fg">
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || picked.length === 0 || !body.trim() || subject.trim().length < 3}
              className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-accent-contrast disabled:opacity-40"
            >
              {busy ? 'Sending' : `Send to ${picked.length || ''}`.trim()}
            </button>
          )}
        </div>
      </div>
    </ModalShell>,
    document.body,
  )
}
