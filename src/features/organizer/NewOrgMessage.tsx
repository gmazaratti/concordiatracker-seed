import { useEffect, useState } from 'react'
import { Loader2, Search, SendHorizonal, Users } from 'lucide-react'
import { orgDmCandidates, sendOrgDm, type DmCandidate } from '@/lib/org-messages'
import { PersonAvatar } from '@/features/community/PersonAvatar'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

/**
 * A club opening a conversation.
 *
 * THE LIST IS THE GUARDRAIL MADE VISIBLE. It contains the club's followers
 * who have not switched club messages off, and nobody else — so the rule is
 * not an error message after the fact, it is the shape of the picker. The
 * database enforces it again on send (`send_org_dm`), because a client-side
 * list is a suggestion.
 *
 * ONE OPENER, THEN IT IS THEIR TURN. A club that can send five unanswered
 * messages is a club that can harass somebody politely, so the second is
 * refused until they answer — said in the composer rather than discovered.
 */
export function NewOrgMessage({
  orgId,
  onSent,
  onCancel,
}: {
  orgId: string
  onSent: (userId: string) => void
  onCancel: () => void
}) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<DmCandidate[] | null>(null)
  const [picked, setPicked] = useState<DmCandidate | null>(null)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!orgId || picked) return
    let alive = true
    const id = setTimeout(() => {
      void orgDmCandidates(orgId, q)
        .then((r) => alive && setRows(r))
        .catch((e: unknown) => alive && setErr(e instanceof Error ? e.message : 'Could not load.'))
    }, 220)
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [orgId, q, picked])

  function send() {
    if (!picked) return
    setBusy(true)
    setErr('')
    void sendOrgDm(orgId, picked.userId, body.trim())
      .then(() => onSent(picked.userId))
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Could not send.'))
      .finally(() => setBusy(false))
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="text-[14px] font-semibold text-fg">
          {picked ? `Message ${picked.name}` : 'New message'}
        </h2>
        <button
          type="button"
          onClick={picked ? () => setPicked(null) : onCancel}
          className="ml-auto rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-subtle transition-colors hover:text-fg"
        >
          {picked ? 'Pick somebody else' : 'Cancel'}
        </button>
      </header>

      {!picked ? (
        <>
          <div className="border-b border-border px-4 py-3">
            <label className="flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-2">
              <Search size={14} className="shrink-0 text-subtle" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search your followers"
                className="w-full min-w-0 bg-transparent text-[13.5px] text-fg placeholder:text-subtle focus:outline-none"
              />
            </label>
            <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-snug text-subtle">
              <Users size={12} className="mt-0.5 shrink-0" aria-hidden />
              {/* Said plainly, because "why isn't this person here" is the
                  question this screen will be asked most often. */}
              You can only start a conversation with somebody who follows you and
              has left club messages on. Anyone who has written to you already is
              in your inbox.
            </p>
          </div>

          {rows === null ? (
            <div className="grid flex-1 place-items-center">
              <Loader2 className="size-5 animate-spin text-accent" aria-label="Loading" />
            </div>
          ) : rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-subtle">
              {/* NEITHER SENTENCE MAY CLAIM THE REASON. `org_dm_candidates`
                  filters on following AND on their opt-out at once, so a club
                  with a follower who has club messages off sees exactly the
                  same empty list as a club with no followers — and telling
                  them "nobody follows you" would be plainly false. */}
              {q
                ? 'Nobody here by that name.'
                : 'No one to message yet. People who follow you, and leave club messages on, show up here.'}
            </p>
          ) : (
            <ul className="flex-1 divide-y divide-border overflow-y-auto">
              {rows.map((r) => (
                <li key={r.userId}>
                  <button
                    type="button"
                    onClick={() => setPicked(r)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2"
                  >
                    <PersonAvatar
                      person={{ handle: r.handle ?? '', name: r.name, avatar_url: r.avatarUrl }}
                      className="size-8"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-fg">{r.name}</span>
                      {r.handle && (
                        <span className="block truncate text-[12px] text-subtle">@{r.handle}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="flex flex-1 flex-col p-4">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
            <PersonAvatar
              person={{ handle: picked.handle ?? '', name: picked.name, avatar_url: picked.avatarUrl }}
              className="size-8"
            />
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-medium text-fg">{picked.name}</span>
              <span className="block text-[11.5px] text-subtle">Follows your club</span>
            </span>
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            maxLength={2000}
            autoFocus
            placeholder={`Write to ${picked.name.split(' ')[0]}…`}
            className="mt-3 w-full resize-none rounded-xl border border-border bg-surface-2 px-3.5 py-3 text-[15px] leading-relaxed text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          <p className="mt-2 text-[11.5px] text-subtle">
            One message, then it is their turn — you can write again once they answer.
          </p>
          {err && <p className="mt-2 text-[12.5px] text-danger">{err}</p>}

          <div className="mt-3 flex">
            <Button className={cn('ml-auto')} disabled={!body.trim() || busy} onClick={send}>
              {busy ? (
                <Loader2 size={15} className="animate-spin" aria-hidden />
              ) : (
                <SendHorizonal size={15} aria-hidden />
              )}
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
