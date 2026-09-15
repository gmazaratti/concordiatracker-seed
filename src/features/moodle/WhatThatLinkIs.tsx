import { CalendarClock, Lock, RefreshCw } from 'lucide-react'

/**
 * The honest part.
 *
 * Both columns matter. "What this gives you" without "what we can see" reads
 * like marketing; the limits are what make the first column believable.
 */
export function WhatThatLinkIs() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
        <Lock size={14} className="text-subtle" aria-hidden />
        What that link is, and what we do with it
      </h3>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
            What it gets you
          </p>
          {/* THE TEXT MUST BE ONE <span>. In a flex container every child —
              including each bare text node and each inline <strong> — becomes
              its own flex ITEM, so a sentence with bold words in it was laid
              out as three boxes side by side and wrapped to one word a line.
              The right-hand list never had the bug because its items are not
              flex. Wrapping the prose puts it back in normal inline flow with
              only the icon as a sibling. */}
          <ul className="mt-1.5 space-y-2 text-[12.5px] leading-relaxed text-muted">
            <li className="flex gap-2">
              <CalendarClock size={13} className="mt-[3px] shrink-0 text-accent" aria-hidden />
              <span>
                Every Moodle deadline lands in your{' '}
                <strong className="font-medium text-fg">Calendar</strong>, on the &ldquo;My
                calendar&rdquo; layer, beside your own deadlines.
              </span>
            </li>
            <li className="flex gap-2">
              <RefreshCw size={13} className="mt-[3px] shrink-0 text-accent" aria-hidden />
              <span>
                Re-checked nightly. If a professor moves a date,{' '}
                <strong className="font-medium text-fg">the item says so</strong> &mdash; old date
                and new, so you can see what changed rather than finding it moved.
              </span>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
            The limits
          </p>
          <ul className="mt-1.5 space-y-2 text-[12.5px] leading-relaxed text-muted">
            <li>
              The link is <strong className="font-medium text-fg">read-only</strong> and covers your
              calendar only. It cannot see your grades, your submissions or your messages, and
              nothing can be changed in Moodle through it.
            </li>
            <li>
              It is <strong className="font-medium text-fg">not your password</strong>, and we never
              ask for one.
            </li>
            <li>
              We store it where{' '}
              <strong className="font-medium text-fg">our own app cannot read it back</strong> — only
              the sync job can use it.
            </li>
            <li>
              Take it back any time: <strong className="font-medium text-fg">Disconnect</strong>{' '}
              here, or reset the token in Moodle, which kills every copy of the link at once.
            </li>
          </ul>
        </div>
      </div>
      <p className="mt-3 border-t border-border pt-3 text-[11.5px] leading-relaxed text-subtle">
        Moodle does not tell us what an assignment is worth, so synced items arrive as calendar
        deadlines, not graded assessments — they will not change your GPA or your grade breakdown.
      </p>
    </div>
  )
}
