import { useState } from 'react'
import { Check, MapPin, Plus } from 'lucide-react'
import { InfoHint } from '@/components/ui/InfoHint'
import { PROGRAM_CHIPS, mapLinkProblem } from './event-audience'
import { cn } from '@/lib/cn'

/**
 * Who an event is for, and where it is — the two fields that were free text
 * and should not have been.
 */


export function ProgramChips({
  value,
  onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  const [custom, setCustom] = useState('')
  const [adding, setAdding] = useState(false)
  const everyone = value.length === 0 || value.includes('Everyone')

  function toggle(p: string) {
    if (p === 'Everyone') {
      onChange([])
      return
    }
    // Picking a programme means it is no longer for everyone.
    const base = value.filter((v) => v !== 'Everyone')
    onChange(base.includes(p) ? base.filter((v) => v !== p) : [...base, p])
  }

  // A club whose programme is not on the list still has to be able to say so;
  // it is just not the first thing offered.
  const extras = value.filter(
    (v) => v !== 'Everyone' && !(PROGRAM_CHIPS as readonly string[]).includes(v),
  )

  return (
    <div className="flex flex-wrap gap-1.5">
      {PROGRAM_CHIPS.map((p) => {
        const on = p === 'Everyone' ? everyone : value.includes(p)
        return (
          <button
            key={p}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(p)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors duration-150',
              on
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border text-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            {on && <Check size={11} strokeWidth={3} aria-hidden />}
            {p}
          </button>
        )
      })}

      {extras.map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed
          onClick={() => toggle(p)}
          className="inline-flex items-center gap-1 rounded-full border border-accent bg-accent-soft px-2.5 py-1 text-[12px] font-medium text-accent"
        >
          <Check size={11} strokeWidth={3} aria-hidden />
          {p}
        </button>
      ))}

      {adding ? (
        <input
          autoFocus
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onBlur={() => {
            const v = custom.trim()
            if (v) onChange([...value.filter((x) => x !== 'Everyone'), v])
            setCustom('')
            setAdding(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              setCustom('')
              setAdding(false)
            }
          }}
          placeholder="Another programme"
          className="rounded-full border border-accent bg-surface-2 px-2.5 py-1 text-[12px] text-fg focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border-strong px-2.5 py-1 text-[12px] text-subtle transition-colors hover:text-fg"
        >
          <Plus size={11} aria-hidden />
          Other
        </button>
      )}
    </div>
  )
}

/* ── Where it is ───────────────────────────────────────────────────────────── */

/**
 * A room number and, optionally, a map.
 *
 * TYPING STILL WORKS and is still the primary field — "H 920" is what a
 * Concordia student actually needs, and a map of the Hall building tells them
 * nothing they did not know. The link is for the cases where it genuinely
 * helps: a venue off campus, somebody's house, a park.
 *
 * WE STORE A LINK, NOT AN EMBED. Accepting an `<iframe>` from a club means
 * accepting arbitrary markup into a page every student loads. The URL is
 * validated to a maps host and rendered as a link with the host named, which
 * is the same rule the profile's social links follow.
 */

export function MapLinkField({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const problem = mapLinkProblem(value)
  return (
    <div>
      <span className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-muted">
        <MapPin size={12} aria-hidden />
        Map link
        <span className="font-normal text-subtle">Optional</span>
        <InfoHint label="How to get a map link">
          <p className="text-[12.5px] font-medium text-fg">Getting the link</p>
          <ol className="mt-1 list-decimal space-y-1 pl-4 text-[12px] leading-relaxed text-muted">
            <li>Open Google Maps and search for the place.</li>
            <li>
              Press <strong className="font-medium text-fg">Share</strong>, then{' '}
              <strong className="font-medium text-fg">Copy link</strong>.
            </li>
            <li>Paste it here.</li>
          </ol>
          <p className="mt-1.5 text-[11.5px] text-subtle">
            The “Embed a map” tab gives you an <code>&lt;iframe&gt;</code>. We do not take
            those, because accepting markup from anywhere would put it on a page every
            student loads. The plain link opens their own maps app, which is what they
            want on a phone anyway.
          </p>
        </InfoHint>
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://maps.app.goo.gl/…"
        spellCheck={false}
        className={cn(
          'w-full rounded-lg border bg-surface-2 px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:outline-none',
          problem ? 'border-danger' : 'border-border focus:border-accent',
        )}
      />
      {problem ? (
        <p className="mt-1 text-[11.5px] text-danger">{problem}</p>
      ) : (
        <p className="mt-1 text-[11.5px] text-subtle">
          Students see a “Open in Maps” link. Typing the room above is still what most
          people need.
        </p>
      )}
    </div>
  )
}
