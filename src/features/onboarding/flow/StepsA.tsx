import { AtSign, Check, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Stage, StepCopy } from './ObParts'
import { beam } from './ob-beam'
import { AvatarPicker } from './AvatarPicker'

/* ── Name ─────────────────────────────────────────────────────────────────── */

export function StepHello({
  name,
  setName,
  returning,
}: {
  name: string
  setName: (v: string) => void
  /** Redoing onboarding: the name is already theirs, so the ask is keep or change. */
  returning: boolean
}) {
  const first = name.trim().split(/\s+/)[0]
  const today = new Intl.DateTimeFormat('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())
  return (
    <>
      <StepCopy
        label={returning ? 'Welcome back' : 'Welcome'}
        title={<>Your whole semester, <span className="text-accent">one screen.</span></>}
        sub={
          returning
            ? 'A quick run through what the app can do. Your courses and grades are untouched.'
            : 'Two minutes, and you will have tried the things students use most.'
        }
      />
      <Stage>
        <label className="block">
          <span className="text-[13px] font-medium text-muted">
            {returning ? 'This is the name we use. Keep it, or change it.' : 'First, what should we call you?'}
          </span>
          <span className={cn('mt-2 block rounded-2xl', beam(!first))}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your first name"
              autoComplete="given-name"
              maxLength={60}
              className="w-full rounded-2xl border border-border bg-canvas px-4 py-3.5 text-[18px] font-medium text-fg outline-none transition-colors duration-200 placeholder:text-subtle focus:border-accent"
            />
          </span>
        </label>
        <div className="mt-4 rounded-2xl border border-border bg-canvas p-4">
          <p className="text-[12px] text-subtle">{today}</p>
          <p className="mt-1 font-display text-[24px] leading-tight font-semibold text-fg">
            Good morning{first ? ',' : ''}{' '}
            <span key={first} className={cn('text-accent', first && 'ct-ob-pop inline-block')}>
              {first || '…'}
            </span>
          </p>
          <p className="mt-2 text-[13px] text-muted">This is how the app greets you every day.</p>
        </div>
      </Stage>
    </>
  )
}

/* ── Handle ───────────────────────────────────────────────────────────────── */

export type HandleState = 'empty' | 'short' | 'checking' | 'taken' | 'ok' | 'mine'

export function StepHandle({
  name,
  handle,
  setHandle,
  state,
}: {
  name: string
  handle: string
  setHandle: (v: string) => void
  /** From the real availability check; 'mine' = the handle they already own. */
  state: HandleState
}) {
  const good = state === 'ok' || state === 'mine'
  return (
    <>
      <StepCopy
        label="Your handle"
        title="Claim your @handle."
        sub="It is how classmates find you, and the address of your profile. Good ones go first."
        note="Your profile stays private until you choose to make it public."
      />
      <Stage>
        <label className="block">
          <span className="text-[13px] font-medium text-muted">{state === 'mine' ? 'Your handle. Keep it, or pick a new one.' : 'Pick a handle'}</span>
          <span className={cn('mt-2 block rounded-2xl', beam(!good))}>
            <span className="flex w-full items-center gap-1 rounded-2xl border border-border bg-canvas px-4 py-3.5 transition-colors duration-200 focus-within:border-accent">
              <AtSign size={18} className="shrink-0 text-subtle" aria-hidden />
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
                placeholder="yourname"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-label="Your handle"
                className="min-w-0 flex-1 bg-transparent text-[18px] font-medium text-fg outline-none placeholder:text-subtle"
              />
              {state === 'checking' && <Loader2 size={16} className="shrink-0 animate-spin text-subtle" aria-hidden />}
              {good && (
                <span className="ct-ob-pop grid size-6 shrink-0 place-items-center rounded-full bg-success text-white">
                  <Check size={14} strokeWidth={3.5} aria-hidden />
                </span>
              )}
              {state === 'taken' && (
                <span className="ct-ob-pop grid size-6 shrink-0 place-items-center rounded-full bg-danger text-white">
                  <X size={14} strokeWidth={3.5} aria-hidden />
                </span>
              )}
            </span>
          </span>
        </label>
        <p className={cn('mt-2 min-h-[20px] text-[13px]', good ? 'text-success' : state === 'taken' ? 'text-danger' : 'text-subtle')} aria-live="polite">
          {state === 'ok' && `@${handle} is free. It is yours.`}
          {state === 'mine' && `@${handle} is already yours.`}
          {state === 'taken' && `@${handle} is taken. Try adding a number or your last name.`}
          {state === 'short' && 'At least 3 characters.'}
          {state === 'checking' && 'Checking…'}
          {state === 'empty' && 'Letters, numbers and underscores.'}
        </p>

        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-canvas p-4">
          <AvatarPicker />
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-fg">{name.trim() || 'Your name'}</span>
            <span key={handle} className={cn('block truncate text-[13px]', good ? 'ct-ob-pop text-accent' : 'text-subtle')}>
              concordiatracker.com/@{handle || '…'}
            </span>
            <span className="mt-0.5 block text-[12px] text-subtle">Tap the photo to add or change your picture.</span>
          </span>
        </div>
      </Stage>
    </>
  )
}
