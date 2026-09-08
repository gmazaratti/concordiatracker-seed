import { ModalShell } from '@/command/ModalShell'
import type { SectionOption } from '@/lib/seats'
import { termLabel } from '@/lib/seats'
import { cn } from '@/lib/cn'
import { seatSummary } from './seat-summary'

/**
 * Everything Concordia publishes about one section, in one card.
 *
 * Reached from the right-click menu on the week and from the seat line in the
 * picked list. It shows what the schedule feed carries and says plainly what it
 * does not — the feed has no teaching-staff field at all, and inventing one
 * would be the worst species of wrong answer: plausible, unverifiable, and
 * attached to a real person's name.
 */
export function SectionDetails({
  code,
  section,
  onClose,
}: {
  code: string
  section: SectionOption
  onClose: () => void
}) {
  const seats = seatSummary(section)
  return (
    <ModalShell label={`${code} details`} onClose={onClose} widthClass="sm:max-w-sm">
      <div className="p-4 sm:p-5">
        <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
          {section.termCode ? termLabel(section.termCode) : 'On your schedule'}
        </p>
        <h2 className="mt-0.5 font-display text-[17px] font-medium text-fg">
          {code} <span className="text-muted">{section.section}</span>
        </h2>
        {section.courseTitle && (
          <p className="mt-0.5 text-[12.5px] text-muted">{section.courseTitle}</p>
        )}

        <dl className="mt-4 space-y-2">
          <Row label="Meets" value={section.meetingTimes || 'No scheduled time'} />
          <Row
            label="Where"
            value={
              section.building
                ? `${section.building} ${section.room}`.trim()
                : section.instructionMode || section.location || 'Not published'
            }
          />
          {section.componentLabel && <Row label="Component" value={section.componentLabel} />}
          {section.instructionMode && <Row label="Delivery" value={section.instructionMode} />}
          {section.location && <Row label="Campus" value={campusName(section.location)} />}
          {/* The number the Student Centre actually asks for. Nothing else on
              this card gets you registered. */}
          {!section.classNumber.startsWith('current-') && (
            <Row label="Class number" value={section.classNumber} mono />
          )}
        </dl>

        {seats && (
          <div
            className={cn(
              'mt-4 rounded-lg border px-3 py-2.5',
              seats.open > 0
                ? 'border-success/40 bg-success/10'
                : 'border-warning/40 bg-warning/10',
            )}
          >
            <p className="text-[12.5px] font-medium text-fg">{seats.headline}</p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-subtle">{seats.detail}</p>
          </div>
        )}

        {/* Said once, here, rather than left as a blank row that reads like a
            loading state. */}
        <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-subtle">
          Concordia&rsquo;s schedule feed does not publish who teaches a section, so this card
          cannot show it. Once the outline is up, the instructor appears on the course itself.
        </p>
      </div>
    </ModalShell>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-24 shrink-0 text-[11.5px] text-subtle">{label}</dt>
      <dd className={cn('min-w-0 flex-1 text-[12.5px] text-fg', mono && 'font-mono tabular-nums')}>
        {value}
      </dd>
    </div>
  )
}

function campusName(location: string): string {
  const loc = location.toUpperCase()
  if (loc.includes('LOY')) return 'Loyola'
  if (loc.includes('SGW')) return 'Sir George Williams'
  return location
}
