import { ModalShell } from '@/command/ModalShell'
import type { Message } from '@/lib/social'
import { type Reaction } from '@/lib/message-extras'
import { ReportSheet } from '@/components/ReportSheet'

const FULL = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/**
 * When a message was sent and when it was read.
 *
 * READ TIMES FOLLOW THE RECEIPTS RULE. For a message you sent, the read time
 * is only shown when both of you have receipts on — the same rule as the ticks
 * — and the dialog says which of the three is true rather than showing a
 * blank. For one you received, the read time is yours, so it is always shown.
 */
export function MessageInfo({
  message,
  mine,
  otherName,
  readAt,
  shared,
  reactions,
  me,
  onClose,
}: {
  message: Message
  mine: boolean
  otherName: string
  /** From `thread_receipts` — present only when receipts are shared. */
  readAt?: string
  shared: boolean
  reactions: Reaction[]
  me: string | null
  onClose: () => void
}) {
  const read = mine
    ? readAt
      ? FULL.format(new Date(readAt))
      : shared
        ? 'Not read yet'
        : 'Read receipts are off in this chat'
    : message.read_at
      ? `You read it ${FULL.format(new Date(message.read_at))}`
      : 'Not read yet'
  return (
    <ModalShell label="Message info" onClose={onClose}>
      <div className="px-5 pt-5 pb-5">
        <h2 className="text-[16px] font-semibold text-fg">Message info</h2>
        {message.body.trim() && (
          <p className="mt-3 line-clamp-4 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13.5px] break-words whitespace-pre-wrap text-fg">
            {message.body}
          </p>
        )}
        <dl className="mt-4 divide-y divide-border rounded-xl border border-border text-[13px]">
          <Row label={mine ? 'Sent' : `Sent by ${otherName}`} value={FULL.format(new Date(message.created_at))} />
          <Row label={mine ? `Seen by ${otherName}` : 'Read'} value={read} />
          <Row
            label="Reactions"
            value={
              reactions.length
                ? reactions.map((r) => `${r.emoji} ${r.userId === me ? 'You' : otherName}`).join('  ·  ')
                : 'None'
            }
          />
        </dl>
      </div>
    </ModalShell>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3.5 py-2.5">
      <dt className="shrink-0 text-subtle">{label}</dt>
      <dd className="text-right text-fg">{value}</dd>
    </div>
  )
}

/**
 * Reporting a message: the shared sheet (components/ReportSheet), with a reason.
 * What we receive is the message and who sent it, nothing else from the chat.
 */
export function ReportDialog({
  message,
  from,
  onClose,
  onDone,
}: {
  message: Message
  from: { name: string | null; handle: string | null }
  onClose: () => void
  onDone: (caseId: string) => void
}) {
  const who = from.handle ? `@${from.handle}` : (from.name ?? 'someone')
  return (
    <ReportSheet
      target="message"
      subject={`Reported message from ${who}`}
      preview={message.body.trim() || 'An attachment'}
      details={[
        'A message was reported from a direct conversation.',
        `From: ${from.name ?? ''} ${who} (user ${message.sender})`,
        `Sent: ${new Date(message.created_at).toISOString()}`,
        `Message id: ${message.id}`,
        '',
        'Text:',
        message.body.trim() || '(no text, just an attachment)',
      ]}
      onClose={onClose}
      onSent={onDone}
    />
  )
}
