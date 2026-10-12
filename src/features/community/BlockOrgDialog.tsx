import { useState } from 'react'
import { Ban, Loader2 } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { blockOrg } from '@/lib/org-blocks'
import { blockUser } from '@/lib/social'

/**
 * Blocking a club. One dialog for every place it can start (a post, a story,
 * an event, the club's profile) so the sentence about what happens is the same
 * everywhere: its posts, stories and events leave your feed now, you unfollow
 * it, it is not told, and we are, so the content can be reviewed.
 */
export function BlockOrgDialog({
  org,
  onClose,
  onBlocked,
}: {
  org: { id: string; handle: string; name: string }
  onClose: () => void
  onBlocked?: () => void
}) {
  return (
    <BlockDialog
      name={org.name}
      lines={[
        'Its posts, stories and events disappear from your feed right away.',
        'You stop following it. It is not told.',
        'We are notified, so its content can be reviewed.',
        'Undo it any time in Settings, Privacy, Blocked accounts.',
      ]}
      run={() => blockOrg(org)}
      onClose={onClose}
      onBlocked={onBlocked}
    />
  )
}

/** Blocking a person from something they wrote (a comment, a message). */
export function BlockPersonDialog({
  handle,
  onClose,
  onBlocked,
}: {
  handle: string
  onClose: () => void
  onBlocked?: () => void
}) {
  return (
    <BlockDialog
      name={`@${handle}`}
      lines={[
        'Their comments and messages disappear for you right away.',
        'You stop following each other. They are not told.',
        'We are notified, so their content can be reviewed.',
        'Undo it any time in Settings, Privacy, Blocked accounts.',
      ]}
      run={async () => ((await blockUser(handle)) ? null : 'That did not go through. Nothing changed.')}
      onClose={onClose}
      onBlocked={onBlocked}
    />
  )
}

function BlockDialog({
  name,
  lines,
  run,
  onClose,
  onBlocked,
}: {
  name: string
  lines: string[]
  run: () => Promise<string | null>
  onClose: () => void
  onBlocked?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const go = async () => {
    setBusy(true)
    setError('')
    const err = await run()
    setBusy(false)
    if (err) setError(err)
    else {
      onBlocked?.()
      onClose()
    }
  }

  return (
    <ModalShell label={`Block ${name}`} onClose={onClose} widthClass="sm:max-w-sm">
      <div className="px-4 pt-3 pb-4">
        <div className="flex items-center gap-2.5 pr-9">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-danger/15 text-danger">
            <Ban size={15} aria-hidden />
          </span>
          <h2 className="text-[15px] font-semibold text-fg">Block {name}?</h2>
        </div>
        <ul className="mt-3 flex flex-col gap-1.5 text-[13px] leading-relaxed text-muted">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-muted hover:text-fg">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void go()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-danger px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
            Block
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
