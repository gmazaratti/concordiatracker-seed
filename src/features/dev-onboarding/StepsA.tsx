import { AtSign, Check, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { TAKEN, cleanHandle } from './ob-data'
import { Stage, StepCopy } from './ObParts'
import { beam } from './ob-beam'

/* ── 1. Hello ─────────────────────────────────────────────────────────────── */

export function StepHello({ name, setName }: { name: string; setName: (v: string) => void }) {
  const first = name.trim().split(/\s+/)[0]
  return (
    <>
      <StepCopy
        label="Welcome"
        title={<>Your whole semester, <span className="text-accent">one screen.</span></>}
        sub="Two minutes, and you will have tried the things students use most. Nothing here is saved yet."
      />
      <Stage>
        <label className="block">
          <span className="text-[13px] font-medium text-muted">First, what should we call you?</span>
          <span className={cn('mt-2 block rounded-2xl', beam(!first))}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your first name"
              autoComplete="given-name"
              className="w-full rounded-2xl border border-border bg-canvas px-4 py-3.5 text-[18px] font-medium text-fg outline-none transition-colors duration-200 placeholder:text-subtle focus:border-accent"
            />
          </span>
        </label>
        <div className="mt-4 rounded-2xl border border-border bg-canvas p-4">
          <p className="text-[12px] text-subtle">Tuesday, November 10</p>
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

/* ── 2. Claim your handle ─────────────────────────────────────────────────── */

type HandleState = 'empty' | 'short' | 'taken' | 'ok'

function stateOf(handle: string): HandleState {
  if (!handle) return 'empty'
  if (handle.length < 3) return 'short'
  return TAKEN.has(handle) ? 'taken' : 'ok'
}

export function StepHandle({ name, handle, setHandle }: { name: string; handle: string; setHandle: (v: string) => void }) {
  const state = stateOf(handle)
  const first = name.trim().split(/\s+/)[0] || ''
  const initials = (name.trim() || 'You')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
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
          <span className="text-[13px] font-medium text-muted">Pick a handle</span>
          <span className={cn('mt-2 block rounded-2xl', beam(state !== 'ok'))}>
            <span className="flex w-full items-center gap-1 rounded-2xl border border-border bg-canvas px-4 py-3.5 transition-colors duration-200 focus-within:border-accent">
              <AtSign size={18} className="shrink-0 text-subtle" aria-hidden />
              <input
                value={handle}
                onChange={(e) => setHandle(cleanHandle(e.target.value))}
                placeholder={cleanHandle(first) || 'yourname'}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-label="Your handle"
                className="min-w-0 flex-1 bg-transparent text-[18px] font-medium text-fg outline-none placeholder:text-subtle"
              />
              {state === 'ok' && (
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
        <p
          className={cn('mt-2 min-h-[20px] text-[13px]', state === 'ok' ? 'text-success' : state === 'taken' ? 'text-danger' : 'text-subtle')}
          aria-live="polite"
        >
          {state === 'ok' && `@${handle} is yours.`}
          {state === 'taken' && `@${handle} is taken. Try adding a number or your last name.`}
          {state === 'short' && 'At least 3 characters.'}
          {state === 'empty' && 'Letters, numbers and underscores.'}
        </p>

        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-canvas p-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-soft text-[16px] font-bold text-accent">{initials}</span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-fg">{name.trim() || 'Your name'}</span>
            <span key={handle} className={cn('block truncate text-[13px]', state === 'ok' ? 'ct-ob-pop text-accent' : 'text-subtle')}>
              concordiatracker.com/@{handle || '…'}
            </span>
          </span>
        </div>
      </Stage>
    </>
  )
}
