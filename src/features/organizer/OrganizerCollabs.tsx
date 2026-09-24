import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Handshake, Loader2, X } from 'lucide-react'
import { Mascot } from '@/components/Mascot'
import {
  collabMessage,
  listCollabInvites,
  respondCollabInvite,
  type CollabInvite,
} from '@/lib/collab'
import { cn } from '@/lib/cn'

const slugOf = (h: string) => h.replace(/^@/, '')

/**
 * Collab invites — both directions, one screen.
 *
 * INCOMING LEADS, because it is the only half with anything waiting on you.
 * An outgoing invite is a fact to check; an incoming one is a decision, and a
 * screen that opens on the list of things you have already done buries it.
 *
 * ANSWERED INVITES STAY, under their own heading. A club that accepted a
 * collaboration three weeks ago and now wants to know which post that was has
 * nowhere else to look — the post itself only says who is on it, not who
 * asked. They are not a queue, so they are quieter and further down.
 */
export function OrganizerCollabs() {
  const [rows, setRows] = useState<CollabInvite[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    void listCollabInvites().then(setRows)
  }, [])

  useEffect(load, [load])

  const answer = async (inv: CollabInvite, accept: boolean) => {
    const key = `${inv.postId}:${inv.orgId}`
    setBusy(key)
    setError(null)
    const r = await respondCollabInvite(inv.postId, inv.orgId, accept)
    setBusy(null)
    if (r !== 'ok') {
      setError(collabMessage(r))
      return
    }
    load()
  }

  if (rows === null) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }

  const waiting = rows.filter((r) => r.direction === 'incoming' && r.status === 'pending')
  const sent = rows.filter((r) => r.direction === 'outgoing')
  const answered = rows.filter((r) => r.direction === 'incoming' && r.status !== 'pending')

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-[20px] font-semibold text-fg">
          <Handshake size={19} className="text-accent" aria-hidden />
          Collab invites
        </h1>
        <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-subtle">
          When another club puts your name on a post, it lands here. Accepting shows both names
          on it and puts the post on your profile too. It stays their post, and either of you
          can undo it later.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-warning/10 px-3 py-2 text-[12.5px] text-warning">{error}</p>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-5 py-14 text-center">
          <Mascot mood="resting" size="sm" soft className="text-accent" />
          <p className="text-[13.5px] font-medium text-fg">No collab invites</p>
          <p className="max-w-xs text-[12.5px] leading-relaxed text-subtle">
            Invite another club from the post composer, or wait for one to invite you.
          </p>
        </div>
      ) : (
        <div className="space-y-7">
          {waiting.length > 0 && (
            <Section title="Waiting on you" count={waiting.length}>
              {waiting.map((inv) => (
                <Row key={`${inv.postId}:${inv.orgId}`} inv={inv}>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      disabled={busy === `${inv.postId}:${inv.orgId}`}
                      onClick={() => void answer(inv, true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-60"
                    >
                      <Check size={14} aria-hidden />
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={busy === `${inv.postId}:${inv.orgId}`}
                      onClick={() => void answer(inv, false)}
                      aria-label="Decline"
                      className="grid size-8 place-items-center rounded-lg border border-border text-muted transition-colors duration-150 hover:border-danger hover:text-danger disabled:opacity-60"
                    >
                      <X size={15} aria-hidden />
                    </button>
                  </div>
                </Row>
              ))}
            </Section>
          )}

          {sent.length > 0 && (
            <Section title="You invited" count={sent.length}>
              {sent.map((inv) => (
                <Row key={`${inv.postId}:${inv.orgId}`} inv={inv} showOther>
                  <StatusTag status={inv.status} />
                </Row>
              ))}
            </Section>
          )}

          {answered.length > 0 && (
            <Section title="You answered" count={answered.length}>
              {answered.map((inv) => (
                <Row key={`${inv.postId}:${inv.orgId}`} inv={inv}>
                  <StatusTag status={inv.status} />
                </Row>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        {title}
        <span className="rounded-full bg-surface-2 px-1.5 text-[10.5px] font-bold text-muted">
          {count}
        </span>
      </h2>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {children}
      </ul>
    </section>
  )
}

/**
 * One invite, with enough of the post to answer without opening it.
 *
 * The thumbnail is the point: a caption alone does not tell you whether this
 * is the thing you agreed to co-host, and going to the post and back to decide
 * is two navigations per invite.
 */
function Row({
  inv,
  children,
  showOther,
}: {
  inv: CollabInvite
  children: React.ReactNode
  /** On an outgoing row the interesting club is the one you asked, not you. */
  showOther?: boolean
}) {
  const who = showOther ? inv.other : inv.author
  const first = inv.media[0]
  return (
    <li className="flex items-center gap-3 px-3 py-3">
      <Link
        to={`/app/community/org/${slugOf(inv.author.handle)}?tab=posts`}
        className="shrink-0"
        aria-label={`Open ${slugOf(inv.author.handle)}'s posts`}
      >
        {first ? (
          first.kind === 'video' ? (
            <video src={first.url} muted playsInline preload="metadata" className="size-12 rounded-lg object-cover" />
          ) : (
            <img src={first.url} alt="" className="size-12 rounded-lg object-cover" />
          )
        ) : (
          <span className="grid size-12 place-items-center rounded-lg bg-surface-2 text-[10px] text-subtle">
            post
          </span>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-fg">
          {slugOf(who.handle)}
          <span className="font-normal text-subtle">
            {showOther ? ' (you invited them)' : ' invited you'}
          </span>
        </p>
        <p className="truncate text-[12px] text-subtle">
          {inv.caption.trim() || 'No caption'}
        </p>
      </div>
      {children}
    </li>
  )
}

function StatusTag({ status }: { status: CollabInvite['status'] }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
        status === 'accepted' && 'bg-success/15 text-success',
        status === 'declined' && 'bg-surface-2 text-subtle',
        status === 'pending' && 'bg-warning/15 text-warning',
      )}
    >
      {status === 'accepted' ? 'Accepted' : status === 'declined' ? 'Declined' : 'Pending'}
    </span>
  )
}
