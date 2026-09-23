import { useState } from 'react'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { NEVER, UNLIMITED, isUnlimited, neverExpires } from './club-invites'
import { cn } from '@/lib/cn'

const chip = (on: boolean) =>
  cn(
    'rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-150',
    on ? 'border-accent bg-accent-soft text-fg' : 'border-border text-muted hover:bg-surface-2 hover:text-fg',
  )

/**
 * How many people may use the link. The first person claims the club; every
 * later use joins its team as a Member — so "5 uses" means "the president and
 * four execs", never five people fighting over one club.
 */
export function UsesField({ value, used = 0, onChange }: { value: number; used?: number; onChange: (n: number) => void }) {
  const min = Math.max(1, used)
  const presets = [1, 5, 10]
  // Its own text state: a controlled input fed from `value` would blank the
  // moment "1" (a preset) was typed on the way to "12".
  const [draft, setDraft] = useState(() => (!presets.includes(value) && !isUnlimited(value) ? String(value) : ''))
  const custom = draft !== '' && !presets.includes(value) && !isUnlimited(value)
  return (
    <div>
      <span className="mb-1.5 block text-[12px] font-medium text-muted">Number of uses</span>
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((n) => (
          <button key={n} type="button" disabled={n < min} onClick={() => { setDraft(''); onChange(n) }} className={cn(chip(value === n && !custom), 'disabled:opacity-40')}>
            {n}
          </button>
        ))}
        <button type="button" onClick={() => { setDraft(''); onChange(UNLIMITED) }} className={chip(isUnlimited(value))}>
          Unlimited
        </button>
        <label className={cn(chip(custom), 'flex items-center gap-1.5 py-1')}>
          <span>Custom</span>
          <input
            type="number"
            min={min}
            max={9999}
            value={draft}
            placeholder="#"
            onChange={(e) => {
              setDraft(e.target.value)
              const n = Math.round(Number(e.target.value))
              if (e.target.value && Number.isFinite(n) && n >= min) onChange(Math.min(n, 9999))
            }}
            className="w-14 bg-transparent text-fg outline-none placeholder:text-subtle"
            aria-label="Custom number of uses"
          />
        </label>
      </div>
      <p className="mt-1.5 text-[11.5px] text-subtle">
        The first person sets up the club; anyone after them joins its team as a Member.
        {used > 0 && ` Already used ${used}×, so it cannot go lower than that.`}
      </p>
    </div>
  )
}

const DAY = 86_400_000

export function ExpiryField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  // The clock is read once (render must stay pure); the buttons read it
  // fresh when pressed.
  const [now] = useState(() => Date.now())
  const inDays = (d: number) => new Date(now + d * DAY).toISOString()
  // Which preset is lit is decided by distance from now, within a day.
  const near = (d: number) => Math.abs(new Date(value).getTime() - (now + d * DAY)) < DAY / 2
  return (
    <div>
      <span className="mb-1.5 block text-[12px] font-medium text-muted">Expires</span>
      <div className="flex flex-wrap items-center gap-2">
        {[1, 7, 30, 90].map((d) => (
          <button key={d} type="button" onClick={() => onChange(inDays(d))} className={chip(!neverExpires(value) && near(d))}>
            {d === 1 ? '1 day' : `${d} days`}
          </button>
        ))}
        <button type="button" onClick={() => onChange(NEVER)} className={chip(neverExpires(value))}>
          Never
        </button>
      </div>
      {!neverExpires(value) && (
        <div className="mt-2 max-w-[260px]">
          <DateTimePicker value={value} onChange={(iso) => iso && onChange(iso)} ariaLabel="Expiry date and time" />
        </div>
      )}
    </div>
  )
}
