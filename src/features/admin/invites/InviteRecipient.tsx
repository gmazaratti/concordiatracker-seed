import { useEffect, useState } from 'react'
import { AtSign, Link2, Mail, Search, UserRound, X } from 'lucide-react'
import { initialsOf } from '@/lib/initials'
import { findUsers, validEmail, type FoundUser, type Recipient } from './club-invites'
import { cn } from '@/lib/cn'

const INPUT =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

export function Face({ user, size = 32 }: { user: Pick<FoundUser, 'avatar_url' | 'name' | 'handle'>; size?: number }) {
  return user.avatar_url ? (
    <img src={user.avatar_url} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-muted" style={{ width: size, height: size }}>
      {initialsOf(user.name, user.handle)}
    </span>
  )
}

/**
 * How the invite reaches them: a link you pass on yourself, an email, or a
 * person already on the platform. A direct invite (email / person) can only
 * be accepted by that recipient — which is why the person search ends in a
 * confirmation gate, handled by the dialog that owns this control.
 */
export function InviteRecipient({ value, onChange }: { value: Recipient; onChange: (r: Recipient) => void }) {
  const [email, setEmail] = useState(value.kind === 'email' ? value.email : '')
  const [q, setQ] = useState('')
  const [results, setResults] = useState<FoundUser[]>([])

  useEffect(() => {
    if (value.kind !== 'user' || q.trim().length < 2) return
    let alive = true
    const id = setTimeout(() => void findUsers(q.trim()).then((r) => alive && setResults(r)), 220)
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [q, value.kind])

  const tabs: { kind: Recipient['kind']; label: string; icon: typeof Mail }[] = [
    { kind: 'link', label: 'Share a link', icon: Link2 },
    { kind: 'email', label: 'Email', icon: Mail },
    { kind: 'user', label: 'Existing user', icon: UserRound },
  ]
  const pick = (k: Recipient['kind']) => {
    if (k === 'link') onChange({ kind: 'link' })
    else if (k === 'email') onChange({ kind: 'email', email })
    // A person is only "chosen" once one is picked; until then it is a search.
    else onChange({ kind: 'user', user: { user_id: '', name: null, handle: null, avatar_url: null, email: null } })
  }
  const chosen = value.kind === 'user' && value.user.user_id ? value.user : null

  return (
    <div>
      <span className="mb-1.5 block text-[12px] font-medium text-muted">How should it reach them?</span>
      <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-surface-2/60 p-1" role="radiogroup">
        {tabs.map((t) => (
          <button
            key={t.kind}
            type="button"
            role="radio"
            aria-checked={value.kind === t.kind}
            onClick={() => pick(t.kind)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[12.5px] font-medium transition-colors',
              value.kind === t.kind ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
            )}
          >
            <t.icon size={14} aria-hidden />
            <span className="truncate">{t.label}</span>
          </button>
        ))}
      </div>

      {value.kind === 'email' && (
        <div className="mt-2.5">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              onChange({ kind: 'email', email: e.target.value })
            }}
            placeholder="president@club.ca"
            className={INPUT}
            autoFocus
          />
          <p className={cn('mt-1 text-[11.5px]', email && !validEmail(email) ? 'text-danger' : 'text-subtle')}>
            {email && !validEmail(email)
              ? 'That does not look like an email address.'
              : 'We email them the invite. Only an account with this email can accept it.'}
          </p>
        </div>
      )}

      {value.kind === 'user' &&
        (chosen ? (
          <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-accent/50 bg-accent-soft px-3 py-2.5">
            <Face user={chosen} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-fg">{chosen.name || 'No name'}</span>
              <span className="block truncate text-[12px] text-subtle">
                {chosen.handle ? `@${chosen.handle}` : 'no handle'} · {chosen.email}
              </span>
            </span>
            <button
              type="button"
              onClick={() => pick('user')}
              aria-label="Choose someone else"
              className="grid size-8 place-items-center rounded-full text-subtle hover:bg-surface-2 hover:text-fg"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        ) : (
          <div className="mt-2.5">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 focus-within:border-accent">
              <Search size={15} className="shrink-0 text-subtle" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search a name, @handle or email"
                className="w-full bg-transparent py-2 text-[14px] text-fg placeholder:text-subtle focus:outline-none"
                autoFocus
              />
            </div>
            {q.trim().length >= 2 && (
              <ul className="mt-1.5 max-h-60 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-surface">
                {results.length === 0 ? (
                  <li className="px-3 py-2.5 text-[12.5px] text-subtle">No one found.</li>
                ) : (
                  results.map((u) => (
                    <li key={u.user_id}>
                      <button
                        type="button"
                        onClick={() => onChange({ kind: 'user', user: u })}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-2"
                      >
                        <Face user={u} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-medium text-fg">{u.name || 'No name'}</span>
                          <span className="flex items-center gap-1 truncate text-[12px] text-subtle">
                            <AtSign size={11} aria-hidden />
                            {u.handle || 'no handle'} · {u.email}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
            <p className="mt-1 text-[11.5px] text-subtle">They get it in their notifications and by email; only they can accept it.</p>
          </div>
        ))}
    </div>
  )
}
