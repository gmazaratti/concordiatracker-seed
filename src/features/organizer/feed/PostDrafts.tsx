import { useState } from 'react'
import { FilePenLine, Loader2, Send, Trash2 } from 'lucide-react'
import { discardDraftPost, saveDraftPost, type PostDraft } from '@/lib/social-posts'
import { Button } from '@/components/ui/Button'

const AGO = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const nowMs = () => Date.now()

function ago(iso: string | null): string {
  if (!iso) return ''
  const mins = Math.round((new Date(iso).getTime() - nowMs()) / 60_000)
  if (mins > -60) return AGO.format(mins, 'minute')
  const hrs = Math.round(mins / 60)
  if (hrs > -24) return AGO.format(hrs, 'hour')
  return AGO.format(Math.round(hrs / 24), 'day')
}

/**
 * Posts the team has started and nobody has put out yet.
 *
 * ONE PERSON STARTS, ANOTHER FINISHES. Anyone whose role can write drafts can
 * open one and keep going — which is why each card says who started it and who
 * touched it last — and only a role that can publish to the feed gets the Post
 * button. The database enforces both (db/org_drafts.sql); the buttons only
 * reflect it.
 */
export function PostDrafts({
  drafts,
  canPublish,
  onOpen,
  onChanged,
}: {
  drafts: PostDraft[]
  canPublish: boolean
  onOpen: (d: PostDraft) => void
  onChanged: () => void
}) {
  if (drafts.length === 0) return null
  return (
    <section className="mb-7">
      <h2 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        <FilePenLine size={13} className="text-accent" aria-hidden />
        Drafts · {drafts.length}
      </h2>
      <ul className="flex flex-col gap-2">
        {drafts.map((d) => (
          <DraftRow key={d.id} draft={d} canPublish={canPublish} onOpen={() => onOpen(d)} onChanged={onChanged} />
        ))}
      </ul>
      {!canPublish && (
        <p className="mt-2 text-[12px] text-subtle">
          Your role can write drafts. Somebody who can publish to the feed reviews them and posts them.
        </p>
      )}
    </section>
  )
}

function DraftRow({
  draft,
  canPublish,
  onOpen,
  onChanged,
}: {
  draft: PostDraft
  canPublish: boolean
  onOpen: () => void
  onChanged: () => void
}) {
  const [busy, setBusy] = useState<'post' | 'discard' | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [err, setErr] = useState('')
  const cover = draft.media[0]

  const edited =
    draft.lastEditedName && draft.lastEditedName !== draft.authorName
      ? `Started by ${draft.authorName ?? 'a teammate'} · edited by ${draft.lastEditedName} ${ago(draft.lastEditedAt)}`
      : `Started by ${draft.authorName ?? 'a teammate'} ${ago(draft.lastEditedAt ?? draft.createdAt)}`

  return (
    <li className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3">
      <button type="button" onClick={onOpen} className="size-16 shrink-0 overflow-hidden rounded-lg bg-surface-2" aria-label="Open draft">
        {cover && <img src={cover.url} alt="" className="size-full object-cover" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13.5px] text-fg">{draft.caption || <span className="text-subtle">No caption yet</span>}</p>
        <p className="mt-0.5 text-[11.5px] text-subtle">{edited}</p>
        {err && <p className="mt-1 text-[12px] text-danger">{err}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={onOpen}>
            Continue editing
          </Button>
          {canPublish && (
            <Button
              size="sm"
              disabled={!!busy || draft.media.length === 0}
              onClick={() => {
                setBusy('post')
                setErr('')
                void saveDraftPost(draft.id, draft.caption, draft.media, draft.details, true)
                  .then((e) => (e ? setErr(e) : onChanged()))
                  .finally(() => setBusy(null))
              }}
            >
              {busy === 'post' ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Send size={14} aria-hidden />}
              Post
            </Button>
          )}
          {confirm ? (
            <>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => {
                  setBusy('discard')
                  void discardDraftPost(draft.id)
                    .then((ok) => (ok ? onChanged() : setErr('Could not discard it.')))
                    .finally(() => setBusy(null))
                }}
                className="rounded-md bg-danger px-2.5 py-1.5 text-[12px] font-semibold text-white"
              >
                Discard for everyone
              </button>
              <button type="button" onClick={() => setConfirm(false)} className="text-[12px] text-muted hover:text-fg">
                Keep it
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              aria-label="Discard draft"
              className="grid size-8 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-danger"
            >
              <Trash2 size={15} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </li>
  )
}
