import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Info, ShieldQuestion, Wallet } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/features/settings/controls'
import { useAppData } from '@/app/providers/app-data'
import { ACADEMIC_CALENDAR } from '@/data/academic-calendar'
import {
  ASSOCIATIONS,
  FEES_SOURCE,
  FEE_STATUSES,
  HEALTH_DENTAL,
  TUITION_SOURCE,
  TUITION_YEAR,
  type TermKind,
} from '@/data/tuition'
import { estimateTerm, refundIfDropped } from '@/lib/tuition'
import { courseColor } from '@/lib/course-color'
import { formatMonthDay } from '@/lib/date'
import { parseDay } from '@/features/calendar/calendar'
import { usePageMeta } from '@/app/hooks/usePageMeta'
import { PaywallLock } from '@/features/courses/Paywall'

/**
 * Money — what the term costs, and what a decision about it costs.
 *
 * Concordia publishes its rates and publishes its deadlines, and never puts the
 * two together. A student can find out that a credit costs $103.92 and can find
 * out that the DNE deadline is the 16th, but nowhere is anyone told "dropping
 * COMM 217 on Monday returns $477 and dropping it on Wednesday returns nothing".
 * That sentence is the whole tab.
 *
 * Every figure is transcribed by hand from a page the student can open, stamped
 * with the year, and shown with its working — rate × credits, not a total to be
 * taken on trust. It is an estimate of the published rates, not a bill, and the
 * page says so where it matters rather than in a footnote nobody reads.
 */
const SETTINGS_KEY = 'ct_money_profile'

interface Profile {
  statusId: string
  associationId: string
  term: TermKind
  includeHealth: boolean
  newStudent: boolean
}

const DEFAULT_PROFILE: Profile = {
  statusId: 'qc',
  associationId: 'eca',
  term: 'fall',
  includeHealth: true,
  newStudent: false,
}

function readProfile(): Profile {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_PROFILE
    return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) }
  } catch {
    return DEFAULT_PROFILE
  }
}

const dollars = (n: number) =>
  n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 })

export function MoneyPage() {
  usePageMeta({
    title: 'Money',
    description: 'What this term costs, at Concordia’s published rates.',
    path: '/app/money',
    robots: 'noindex',
  })
  const { courses, plan } = useAppData()
  const [profile, setProfile] = useState<Profile>(readProfile)

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(profile))
    } catch {
      /* private mode — it just won't persist */
    }
  }, [profile])

  const credits = courses.reduce((sum, c) => sum + c.credits, 0)
  const estimate = useMemo(() => estimateTerm({ credits, ...profile }), [credits, profile])

  /** The refund window, from the calendar we already transcribed. */
  const refundDeadline = useMemo(() => {
    const now = new Date()
    return ACADEMIC_CALENDAR.filter(
      (e) => e.kind === 'deadline' && /dne|refund|add/i.test(e.title),
    )
      .map((e) => ({ e, when: parseDay(e.start) }))
      .filter((x) => x.when >= now)
      .sort((a, b) => a.when.getTime() - b.when.getTime())[0]
  }, [])

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }))

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-5">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-[20px] leading-tight font-medium text-fg">Money</h2>
          <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-accent uppercase">
            Beta
          </span>
        </div>
        <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted">
          What this term costs, worked out from the credits you are actually registered for at
          Concordia&rsquo;s published {TUITION_YEAR} rates — and what a course is worth if you are
          deciding whether to keep it.
        </p>
      </header>

      {/* ── Who you are, which is most of the answer ─────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-[13px] font-semibold text-fg">Your situation</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11.5px] text-subtle">Fee status</span>
            <Select
              value={profile.statusId}
              onChange={(v) => set('statusId', v)}
              ariaLabel="Fee status"
              options={FEE_STATUSES.map((s) => ({ value: s.id, label: s.label }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] text-subtle">Faculty</span>
            <Select
              value={profile.associationId}
              onChange={(v) => set('associationId', v)}
              ariaLabel="Faculty"
              options={ASSOCIATIONS.map((a) => ({ value: a.id, label: a.label }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] text-subtle">Term</span>
            <Select
              value={profile.term}
              onChange={(v) => set('term', v as TermKind)}
              ariaLabel="Term"
              options={[
                { value: 'fall', label: 'Fall' },
                { value: 'winter', label: 'Winter' },
                { value: 'summer', label: 'Summer' },
              ]}
            />
          </label>
          <div className="flex flex-col justify-end gap-2 pb-0.5">
            <span className="flex items-center justify-between gap-2 text-[12.5px] text-muted">
              Health &amp; dental plan
              <Switch
                checked={profile.includeHealth}
                onChange={(v) => set('includeHealth', v)}
                label="Health and dental plan"
              />
            </span>
            <span className="flex items-center justify-between gap-2 text-[12.5px] text-muted">
              First term at Concordia
              <Switch
                checked={profile.newStudent}
                onChange={(v) => set('newStudent', v)}
                label="First term at Concordia"
              />
            </span>
          </div>
        </div>
      </section>

      {/* ── The number ───────────────────────────────────────────────── */}
      <PaywallLock locked={plan === 'free'} feature="Cost breakdown">
      <section className="mt-4 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[12px] text-subtle">
              {credits} credits registered · {courses.length}{' '}
              {courses.length === 1 ? 'course' : 'courses'}
            </p>
            <p className="mt-0.5 font-display text-[30px] leading-none font-semibold text-fg">
              {dollars(estimate.total)}
            </p>
          </div>
          <p className="text-right text-[12px] text-subtle">
            {dollars(estimate.perCredit)} per credit
            <br />
            <span className="text-[11.5px]">everything that scales with your load</span>
          </p>
        </div>

        {credits === 0 && (
          <p className="mt-3 rounded-lg border border-dashed border-border px-3 py-2.5 text-[12.5px] text-subtle">
            No courses in your current term yet, so this is only the flat fees. Add your term in
            Courses and the number becomes yours.
          </p>
        )}

        <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-lg border border-border">
          {estimate.lines.map((line, i) => (
            <li
              key={`${line.label}-${i}`}
              className="flex items-start gap-3 bg-canvas px-3 py-2 text-[12.5px]"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-fg">{line.label}</span>
                {/* The working, not a total to be trusted: this is what lets a
                    student reconcile us against their real invoice. */}
                <span className="block text-[11px] text-subtle">{line.how}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted">{dollars(line.amount)}</span>
            </li>
          ))}
        </ul>

        <p className="mt-2.5 text-[11.5px] leading-relaxed text-subtle">
          An estimate at the published {TUITION_YEAR} rates, not a bill. It does not know about
          bursaries, exemptions, late penalties or anything specific to your file — the Student
          Centre is the only authority on what you owe.
        </p>
      </section>
      </PaywallLock>

      {/* ── What a course is worth ───────────────────────────────────── */}
      {courses.length > 0 && plan !== 'free' && (
        <section className="mt-4 rounded-xl border border-border bg-surface p-4">
          <h2 className="text-[13px] font-semibold text-fg">What each course is costing you</h2>
          <p className="mt-0.5 mb-3 text-[12px] leading-relaxed text-subtle">
            Concordia publishes its rates and publishes its deadlines, and never puts the two
            together. This is the same decision Radar frames in workload, priced.
          </p>

          <ul className="space-y-1.5">
            {courses.map((course) => (
              <li
                key={course.id}
                className="flex items-center gap-2.5 rounded-lg border border-border bg-canvas px-3 py-2"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: courseColor(course.color).hex }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-medium text-fg">
                    {course.code || 'Untitled course'}
                  </span>
                  <span className="block text-[11px] text-subtle">
                    {course.credits} credits × {dollars(estimate.perCredit)}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] font-medium tabular-nums text-fg">
                  {dollars(refundIfDropped(estimate, course.credits))}
                </span>
              </li>
            ))}
          </ul>

          {refundDeadline && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2.5 text-[12px] leading-relaxed text-muted">
              <Info size={13} className="mt-0.5 shrink-0 text-warning" aria-hidden />
              <span>
                <span className="font-medium text-fg">
                  {refundDeadline.e.title} — {formatMonthDay(refundDeadline.when)}.
                </span>{' '}
                Leaving a course before this date takes it off your bill and off your transcript.
                After it, the course stays as a DISC and the money does not come back.
              </span>
            </p>
          )}
        </section>
      )}

      {/* ── The one fee you can get back ─────────────────────────────── */}
      {profile.includeHealth && profile.term === 'fall' && plan !== 'free' && (
        <section className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
          <ShieldQuestion size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-fg">
              {dollars(HEALTH_DENTAL.amount)} of this is refundable — but only for a few weeks
            </h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
              The health and dental plan is billed once in the fall and covers the year. If you are
              already on a parent&rsquo;s or a partner&rsquo;s plan you can opt out through the
              student union and get it back, but the window closes early in the term and there is
              no second chance. Worth ten minutes if you are covered twice.
            </p>
          </div>
        </section>
      )}

      <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-subtle">
        <span>Rates transcribed from Concordia&rsquo;s published {TUITION_YEAR} schedule.</span>
        <a
          href={TUITION_SOURCE}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-accent hover:underline"
        >
          Tuition rates
          <ExternalLink size={10} aria-hidden />
        </a>
        <a
          href={FEES_SOURCE}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-accent hover:underline"
        >
          Compulsory fees
          <ExternalLink size={10} aria-hidden />
        </a>
      </p>

      <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-subtle">
        <Wallet size={12} aria-hidden />
        Nothing on this page is sent anywhere, and none of it can change your registration.
      </p>
    </div>
  )
}
