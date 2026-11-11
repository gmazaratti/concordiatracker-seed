import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { MessageSquareReply } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { supabase } from '@/lib/supabase'
import { when } from '../../user-detail-data'

interface ReplyRow {
  id: number
  recipient: string
  who: string
  body: string
  reply: string
  replied_at: string
}

/**
 * Every answer to an admin's direct note (send_admin_message), newest first,
 * in one place. They used to be visible only inside that one person's panel
 * in Users, so a reply could sit there unseen. Each opens that person.
 */
export function NoteReplies({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<ReplyRow[] | null>(null)
  useEffect(() => {
    void supabase.rpc('admin_message_replies', { p_limit: 100 }).then(({ data }) => setRows((data ?? []) as ReplyRow[]))
  }, [])
  return createPortal(
    <ModalShell label="Replies to your notes" onClose={onClose}>
      <div className="max-h-[85dvh] overflow-y-auto p-5">
        <h2 className="flex items-center gap-2 text-[17px] font-bold text-fg">
          <MessageSquareReply size={16} className="text-accent" aria-hidden /> Replies to your notes
        </h2>
        <p className="mt-1 text-[12.5px] text-subtle">Answers to the notes sent from a person&rsquo;s panel in Users.</p>
        {rows === null ? (
          <p className="mt-4 text-[13px] text-subtle">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-[13px] text-subtle">No replies yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((r) => (
              <li key={r.id} className="rounded-lg border border-border bg-canvas p-3">
                <p className="text-[12px] text-subtle">You wrote: {r.body}</p>
                <p className="mt-1.5 rounded-md border-l-2 border-accent bg-surface-2 px-2.5 py-1.5 text-[13px] text-fg">{r.reply}</p>
                <p className="mt-1.5 flex items-center justify-between text-[11.5px] text-subtle">
                  <span>
                    {r.who} · {when(r.replied_at)}
                  </span>
                  <Link to={`/admin?tab=users&user=${r.recipient}`} onClick={onClose} className="text-accent hover:underline">
                    Open
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ModalShell>,
    document.body,
  )
}
