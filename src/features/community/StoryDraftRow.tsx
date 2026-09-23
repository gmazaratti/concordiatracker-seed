import { useState } from 'react'
import { deleteStory, publishStoryDraft, type StoryDraft } from '@/lib/social-posts'
import { cn } from '@/lib/cn'

/**
 * A story sent back to drafts: post it again (with a fresh 24/48/72 hours,
 * counted from now) or delete it for good. Delete asks once — a story has no
 * trash.
 */
export function StoryDraftRow({ draft, onChanged }: { draft: StoryDraft; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [armed, setArmed] = useState(false)
  const [err, setErr] = useState('')

  const post = async (hours: 24 | 48 | 72) => {
    setBusy(true)
    setErr('')
    const e = await publishStoryDraft(draft.id, hours)
    setBusy(false)
    if (e) setErr(e)
    else onChanged()
  }
  const remove = async () => {
    setBusy(true)
    setErr('')
    const ok = await deleteStory(draft.id)
    setBusy(false)
    if (ok) onChanged()
    else setErr('That draft could not be deleted.')
  }

  const pill = 'rounded-full border border-border px-2.5 py-1 text-[12px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-50'
  return (
    <li className="flex gap-3 py-2.5">
      <img src={draft.imageUrl} alt="" className="h-20 w-[45px] shrink-0 rounded-lg bg-surface-2 object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] text-fg">{draft.caption?.trim() || 'Story'}</p>
        <p className="mt-1 text-[11.5px] text-subtle">Post again for</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {([24, 48, 72] as const).map((h) => (
            <button key={h} type="button" disabled={busy} onClick={() => void post(h)} className={pill}>
              {h} hours
            </button>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => (armed ? void remove() : setArmed(true))}
            className={cn(pill, 'text-danger hover:text-danger', armed && 'border-danger bg-danger/10')}
          >
            {armed ? 'Delete for good?' : 'Delete'}
          </button>
        </div>
        {err && <p className="mt-1 text-[12px] text-danger">{err}</p>}
      </div>
    </li>
  )
}
