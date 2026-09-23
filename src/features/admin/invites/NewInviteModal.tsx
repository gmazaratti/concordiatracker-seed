import { useState } from 'react'
import { ArrowRight, CircleCheck, PenLine, Sparkles, UserPlus } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { Button } from '@/components/ui/Button'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { useHandleCheck } from '@/features/organizer/onboarding/handle-check'
import { CopyChip } from '../admin-ui'
import { UsesField, ExpiryField } from './InviteLimits'
import { createClubInvite, inviteUrl } from './club-invites'
import { cn } from '@/lib/cn'

const INPUT =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

/** A handle suggestion from the name, in the only shape the wizard accepts. */
function suggest(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20)
}

/**
 * New club invite.
 *
 * THE MODE IS THE FIRST REAL DECISION and is shown as two big choices, not a
 * toggle, because it changes what the recipient will see: a club already
 * built for them to review, or a blank one they build.
 *
 * THE HANDLE IS CHECKED BEFORE ANYTHING EXISTS, by the same database rule the
 * setup wizard applies (`org_handle_problem`). A club created with a handle
 * its own wizard refuses can never finish setup — that is how "john-molson"
 * produced a club nobody could complete. The server checks again on create.
 */
export function NewInviteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [mode, setMode] = useState<'self' | 'prefilled' | null>(null)
  const [uses, setUses] = useState(1)
  const [expires, setExpires] = useState(() => new Date(Date.now() + 30 * 86_400_000).toISOString())
  const [color, setColor] = useState('#5b9cf6')
  const [bio, setBio] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [made, setMade] = useState<{ token: string; org_id: string | null } | null>(null)

  const h = (handle.trim() || suggest(name)).replace(/^@+/, '')
  const check = useHandleCheck(h)
  const handleOk = h.length >= 3 && check.kind === 'free'
  const ready = name.trim().length >= 2 && handleOk && !!mode && !busy

  async function create() {
    if (!ready || !mode) return
    setBusy(true)
    setErr('')
    try {
      const res = await createClubInvite({ name: name.trim(), handle: h, mode, maxUses: uses, expiresAt: expires, color, bio })
      setMade(res)
      onCreated()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (made) {
    return (
      <ModalShell label="Invite created" onClose={onClose} widthClass="sm:max-w-lg">
        <div className="px-5 pt-6 pb-5">
          <CircleCheck size={28} className="text-success" aria-hidden />
          <h2 className="mt-3 text-[18px] font-semibold text-fg">Invite ready</h2>
          <p className="mt-1 text-[13px] text-muted">
            Send this link to whoever runs {name.trim()}. Opening it walks them from creating an account straight into
            {mode === 'prefilled' ? ' reviewing the club you built.' : ' the setup wizard.'}
          </p>
          <div className="mt-4 min-w-0">
            <CopyChip value={inviteUrl(made.token)} title="Copy the invite link" />
          </div>
          {made.org_id && (
            <button
              type="button"
              // A full load, so the club that did not exist a moment ago is in
              // the portal's list; `?org=` names which one to open.
              onClick={() => window.location.assign(`/organizer?org=${made.org_id}`)}
              className="mt-4 flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-surface-2"
            >
              <PenLine size={18} className="shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium text-fg">Keep building the club</span>
                <span className="block text-[12px] text-subtle">Logo, banner, links, a first event or post — in the real editors.</span>
              </span>
              <ArrowRight size={16} className="text-subtle" aria-hidden />
            </button>
          )}
          <Button className="mt-4 w-full" variant="outline" onClick={onClose}>Done</Button>
        </div>
      </ModalShell>
    )
  }

  return (
    <ModalShell label="New club invite" onClose={onClose} widthClass="sm:max-w-xl">
      <div className="space-y-5 px-5 pt-6 pb-5">
        <div>
          <h2 className="text-[18px] font-semibold text-fg">New club invite</h2>
          <p className="mt-0.5 text-[13px] text-subtle">One link. Whoever opens it signs in and lands in setup.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block min-w-0">
            <span className="mb-1 block text-[12px] font-medium text-muted">Club name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Concordia Robotics" className={INPUT} autoFocus />
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-[12px] font-medium text-muted">Handle</span>
            <div className="flex items-center rounded-lg border border-border bg-surface-2 focus-within:border-accent">
              <span className="pl-3 text-[14px] text-subtle">@</span>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value.replace(/^@+/, ''))}
                placeholder={suggest(name) || 'robotics'}
                className="w-full min-w-0 bg-transparent px-1 py-2 text-[14px] text-fg placeholder:text-subtle focus:outline-none"
              />
            </div>
            <span className={cn('mt-1 block text-[11.5px]', check.kind === 'taken' ? 'text-danger' : check.kind === 'free' ? 'text-success' : 'text-subtle')}>
              {h.length > 0 && h.length < 3
                ? 'At least 3 characters.'
                : check.kind === 'taken'
                  ? check.why
                  : check.kind === 'free'
                    ? `@${h} is available`
                    : check.kind === 'checking'
                      ? 'Checking…'
                      : 'Letters, numbers and underscores.'}
            </span>
          </label>
        </div>

        <fieldset>
          <legend className="mb-2 text-[12px] font-medium text-muted">Who sets it up?</legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <ModeCard
              on={mode === 'prefilled'}
              onClick={() => setMode('prefilled')}
              icon={<Sparkles size={20} aria-hidden />}
              title="I'll set it up"
              body="You build the profile now. They review it, edit anything, and confirm."
            />
            <ModeCard
              on={mode === 'self'}
              onClick={() => setMode('self')}
              icon={<UserPlus size={20} aria-hidden />}
              title="They'll set it up"
              body="Just a name and handle. They walk the full setup wizard on first open."
            />
          </div>
        </fieldset>

        {mode === 'prefilled' && (
          <div className="space-y-3 rounded-xl border border-border bg-surface-2/40 p-3.5">
            <div className="flex items-center gap-3">
              <ColorPicker value={color} onChange={setColor} ariaLabel="Brand colour" />
              <span className="text-[12.5px] text-muted">Brand colour</span>
            </div>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} placeholder="A short bio students will see" className={cn(INPUT, 'resize-none')} />
            <p className="text-[11.5px] text-subtle">Logo, banner, links and a first event come next, in the club's own editors.</p>
          </div>
        )}

        <UsesField value={uses} onChange={setUses} />
        <ExpiryField value={expires} onChange={setExpires} />

        {err && <p className="text-[12.5px] text-danger">{err}</p>}
        <Button className="w-full" size="lg" onClick={() => void create()} disabled={!ready}>
          {busy ? 'Creating…' : mode ? 'Create invite link' : 'Choose who sets it up'}
        </Button>
      </div>
    </ModalShell>
  )
}

function ModeCard({ on, onClick, icon, title, body }: { on: boolean; onClick: () => void; icon: React.ReactNode; title: string; body: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'flex flex-col gap-1.5 rounded-xl border-2 p-4 text-left transition-colors duration-150',
        on ? 'border-accent bg-accent-soft' : 'border-border hover:border-border-strong hover:bg-surface-2',
      )}
    >
      <span className={cn('grid size-9 place-items-center rounded-lg', on ? 'bg-accent text-accent-contrast' : 'bg-surface-2 text-muted')}>{icon}</span>
      <span className="text-[14.5px] font-semibold text-fg">{title}</span>
      <span className="text-[12.5px] leading-snug text-muted">{body}</span>
    </button>
  )
}
