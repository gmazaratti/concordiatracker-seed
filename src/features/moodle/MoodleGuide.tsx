import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/cn'

import { MOODLE_EXPORT_URL } from './moodle-ui'

/**
 * The instructions, in the four clicks it actually takes.
 *
 * Written against the real Moodle UI rather than described in the abstract:
 * someone following this should never have to work out what we meant.
 */
export function HowTo() {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface-2/40 p-4">
      <ol className="space-y-2">
        <Step n={1}>
          Open{' '}
          <a
            href={MOODLE_EXPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
          >
            Moodle → Calendar → Export
            <ExternalLink size={11} aria-hidden />
          </a>{' '}
          and sign in if it asks. You will land on the page below.
        </Step>
        <Step n={2}>
          Pick the two highlighted options, then press{' '}
          <strong className="font-medium text-fg">Get calendar URL</strong>.
        </Step>
        <Step n={3}>A long link appears under the buttons. Copy all of it and paste it below.</Step>
      </ol>

      <ExportPagePreview />
    </div>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-[13px] leading-relaxed text-muted">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
        {n}
      </span>
      <span>{children}</span>
    </li>
  )
}

/**
 * A replica of Moodle's Export page, with the two answers marked.
 *
 * Written as markup rather than a screenshot on purpose: a screenshot of
 * someone else's product goes stale the moment they restyle it, weighs more
 * than this does, and cannot be read by a screen reader. This also lets the
 * one genuinely confusing thing be shown rather than described — the page has
 * TWO buttons side by side, and **Export** downloads a file that does nothing
 * for us while **Get calendar URL** produces the link. That is the mistake
 * people actually make.
 *
 * Deliberately not pixel-faithful: it is a diagram of the choices, and dressing
 * it up as Concordia's own page would be a small lie about what you are
 * looking at.
 */
function ExportPagePreview() {
  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-canvas">
      <figcaption className="border-b border-border px-3 py-1.5 text-[11px] text-subtle">
        What you will see on Moodle
      </figcaption>
      <div className="space-y-3 p-3">
        <Field label="Events to export">
          <Choice picked>All events</Choice>
          <Choice>Events related to categories</Choice>
          <Choice>Events related to courses</Choice>
          <Choice>Events related to groups</Choice>
          <Choice>My personal events</Choice>
        </Field>

        <Field label="Time period">
          <Choice>This week</Choice>
          <Choice>This month</Choice>
          <Choice picked>Recent and next 60 days</Choice>
          <Choice>Custom range</Choice>
        </Field>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="rounded-md bg-accent px-2.5 py-1 text-[11.5px] font-medium text-accent-contrast">
            Get calendar URL
          </span>
          <span className="rounded-md border border-border px-2.5 py-1 text-[11.5px] text-subtle line-through">
            Export
          </span>
          <span className="text-[11px] text-subtle">
            ← downloads a file instead, and will not work here
          </span>
        </div>
      </div>
      <p className="border-t border-border px-3 py-2 text-[11px] leading-relaxed text-subtle">
        <strong className="font-medium text-fg">Custom range</strong> works too, and is the better
        pick if you want the whole term rather than the next 60 days.
      </p>
    </figure>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium tracking-wide text-subtle uppercase">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

/** One radio line. `picked` is the answer, and it says so in text too — colour
 *  and a filled dot alone would leave a colourblind reader guessing. */
function Choice({ picked = false, children }: { picked?: boolean; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        'flex items-center gap-2 rounded px-1.5 py-0.5 text-[12px]',
        picked ? 'bg-accent-soft font-medium text-fg' : 'text-subtle',
      )}
    >
      <span
        className={cn(
          'grid size-3 shrink-0 place-items-center rounded-full border',
          picked ? 'border-accent' : 'border-border-strong',
        )}
        aria-hidden
      >
        {picked && <span className="size-1.5 rounded-full bg-accent" />}
      </span>
      {children}
      {picked && <span className="ml-auto text-[10.5px] font-semibold text-accent">PICK THIS</span>}
    </p>
  )
}
