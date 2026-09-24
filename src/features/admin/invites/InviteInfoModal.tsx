import { useEffect, useState } from 'react'
import { Eye, LogIn, UserCheck, UserPlus } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { Loading } from '../admin-ui'
import { atHandle } from '@/lib/handles'
import { inviteEvents, isUnlimited, neverExpires, type ClubInvite, type InviteEvent } from './club-invites'

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—')

/**
 * Everything that happened to one link: made, opened (by whom, when they were
 * signed in), claimed, joined. "Who" is only ever an account that was signed
 * in at the time; an anonymous open is a browser, and it says so rather than
 * guessing a person.
 */
export function InviteInfoModal({ invite: i, onClose }: { invite: ClubInvite; onClose: () => void }) {
  const [events, setEvents] = useState<InviteEvent[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    inviteEvents(i.token)
      .then((e) => alive && setEvents(e))
      .catch((e: Error) => alive && setErr(e.message))
    return () => {
      alive = false
    }
  }, [i.token])

  const facts: [string, string][] = [
    ['Handle', atHandle(i.org_handle)],
    ['Mode', i.mode === 'prefilled' ? 'Pre-filled (you built it)' : 'Self-setup (they build it)'],
    ['Created', when(i.created_at)],
    ['First opened', when(i.first_open_at)],
    ['Last opened', when(i.last_open_at)],
    ['Opens while signed in', String(i.signed_in_opens)],
    ['Claimed', i.claimed_at ? `${when(i.claimed_at)}${i.claimed_email ? ` by ${i.claimed_email}` : ''}` : 'Not yet'],
    ['Uses', `${i.use_count} of ${isUnlimited(i.max_uses) ? 'unlimited' : i.max_uses}`],
    ['Expires', neverExpires(i.expires_at) ? 'Never' : when(i.expires_at)],
    ['Club status', i.org_status ?? 'Not created yet'],
  ]

  return (
    <ModalShell label={`Invite for ${i.org_name}`} onClose={onClose} widthClass="sm:max-w-lg">
      <div className="px-5 pt-6 pb-5">
        <h2 className="text-[18px] font-semibold text-fg">{i.org_name}</h2>
        <dl className="mt-3 divide-y divide-border rounded-xl border border-border">
          {facts.map(([k, v]) => (
            <div key={k} className="flex gap-3 px-3.5 py-2 text-[12.5px]">
              <dt className="w-36 shrink-0 text-subtle">{k}</dt>
              <dd className="min-w-0 flex-1 break-words text-fg">{v}</dd>
            </div>
          ))}
        </dl>

        <h3 className="mt-5 mb-2 text-[13px] font-semibold text-fg">Activity</h3>
        {err ? (
          <p className="text-[12.5px] text-danger">{err}</p>
        ) : events === null ? (
          <Loading />
        ) : events.length === 0 ? (
          <p className="text-[12.5px] text-subtle">
            Nothing recorded yet{i.opens > 0 ? '. This link was opened before per-person tracking existed.' : '.'}
          </p>
        ) : (
          <ol className="space-y-2">
            {events.map((e, n) => (
              <li key={n} className="flex items-start gap-2.5 text-[12.5px]">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-muted">
                  {e.kind === 'claim' ? <UserCheck size={13} /> : e.kind === 'join' ? <UserPlus size={13} /> : e.signed_in ? <LogIn size={13} /> : <Eye size={13} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-fg">
                    {e.kind === 'claim' ? 'Claimed the club' : e.kind === 'join' ? 'Joined the team' : e.signed_in ? 'Opened, signed in' : 'Opened, not signed in'}
                  </span>
                  <span className="block break-words text-subtle">
                    {e.signed_in
                      ? [e.name, e.handle ? `@${e.handle}` : null, e.email].filter(Boolean).join(' · ')
                      : 'An anonymous browser'}{' '}
                    · {when(e.at)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </ModalShell>
  )
}
