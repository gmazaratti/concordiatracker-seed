import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { adminSetUserNotes, type AdminUser } from './admin-data'
import {
  duration,
  setFlagsLogged,
  setPlanLogged,
  when,
  type AuditEntry,
  type UserSummary,
  userCourses,
  type UserCourse,
} from './user-detail-data'
import { Stat } from './admin-ui'
import { ModalShell } from '@/command/ModalShell'
import { cn } from '@/lib/cn'
import { UserMessagePanel } from './UserMessagePanel'

const SOURCE_LABEL: Record<string, string> = {
  catalogue: 'Concordia catalogue',
  manual: 'Typed in',
  blueprint: 'Blueprint import',
  outline: 'Verified outline',
  moodle: 'From Moodle',
  syllabus: 'Uploaded a syllabus',
}

/** Their courses, and how each one got there. */
function CoursesPanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [rows, setRows] = useState<UserCourse[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    void userCourses(userId)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [userId])

  return (
    <ModalShell label="Courses" onClose={onClose} widthClass="sm:max-w-lg">
      <div className="p-4 sm:p-5">
        <h2 className="font-display text-[17px] font-medium text-fg">Courses</h2>
        {failed ? (
          <p className="mt-3 text-[13px] text-danger">Could not load them. Try again.</p>
        ) : !rows ? (
          <p className="mt-3 text-[13px] text-subtle">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-3 text-[13px] text-subtle">No courses on this account.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {rows.map((c) => (
              <li key={c.id} className="flex items-baseline gap-2 py-2">
                <span className="w-[86px] shrink-0 font-mono text-[12px] text-fg">{c.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] text-muted">{c.name || '—'}</span>
                  <span className="block text-[11px] text-subtle">
                    {c.term ?? 'no term'} · {c.assessments} assessment{c.assessments === 1 ? '' : 's'}
                    {c.archived && ' · archived'}
                  </span>
                </span>
                {/* Null is shown as "not recorded" rather than guessed — the
                    inference this replaced labelled every catalogue pick
                    "manual", which is the kind of confident wrong answer that
                    makes a panel worse than no panel. */}
                <span
                  className={cn(
                    'shrink-0 rounded px-1.5 py-0.5 text-[10.5px]',
                    c.source ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-subtle',
                  )}
                >
                  {c.source ? (SOURCE_LABEL[c.source] ?? c.source) : 'Not recorded'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ModalShell>
  )
}

const DURATIONS = [
  { value: '1', label: '1 month' },
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '12', label: '1 year' },
  { value: '0', label: 'Forever' },
]

function monthsFromNow(m: number): string | null {
  if (m === 0) return null
  const d = new Date()
  d.setMonth(d.getMonth() + m)
  return d.toISOString()
}

/**
 * Overview: who they are, what they have done, and the two controls that
 * change their standing.
 *
 * EVERY PRIVILEGED CONTROL HERE DEMANDS A REASON before it will fire. That is
 * not friction for its own sake: four Pro accounts existed that nobody could
 * explain, and the fix is worthless if the next grant is one click with no
 * note attached. The button is disabled until the box has something in it.
 */
export function OverviewTab({
  user,
  summary,
  audit,
  onChanged,
}: {
  user: AdminUser
  summary: UserSummary | null
  audit: AuditEntry[] | null
  onChanged: () => void
}) {
  const [notes, setNotes] = useState(user.admin_notes ?? '')
  const [reason, setReason] = useState('')
  const [months, setMonths] = useState('3')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [showCourses, setShowCourses] = useState(false)
  const isPro = user.plan_status === 'pro'

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setErr('')
    try {
      await fn()
      setReason('')
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  const s = summary
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Visits" value={s ? String(s.visits) : '—'} />
        <Stat label="Total time" value={s ? duration(s.total_seconds) : '—'} />
        <Stat label="Avg visit" value={s ? duration(s.avg_seconds) : '—'} />
        <Stat label="Page views" value={s ? String(s.page_views) : '—'} />
        {/* A number with something behind it. "12 courses" tells you nothing
            you can act on; WHICH classes and HOW they were added is the
            difference between a student who uploaded a syllabus and one who
            imported somebody else's outline. */}
        <Stat
          label="Courses"
          value={String(user.course_count)}
          hint={user.course_count > 0 ? 'Tap to see them' : undefined}
          onClick={user.course_count > 0 ? () => setShowCourses(true) : undefined}
        />
        <Stat label="Assignments" value={String(user.assignment_count)} />
        <Stat label="Syllabus parses" value={s ? String(s.parses) : '—'} />
        <Stat label="Tickets" value={s ? String(s.tickets) : '—'} />
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 rounded-lg border border-border bg-surface p-3 text-[12.5px] sm:grid-cols-2">
        <Row label="Joined" value={when(s?.joined_at ?? user.created_at)} />
        <Row label="Last seen" value={when(s?.last_visit_at ?? null)} />
        <Row label="First visit" value={when(s?.first_seen ?? null)} />
        <Row label="Referral code" value={user.vanity_code ?? '—'} />
        <Row label="Came from" value={user.referred_by_code ?? 'Not attributed'} />
        <Row
          label="Plan"
          value={isPro ? (user.comped ? 'Pro (comped)' : 'Pro') : 'Free'}
        />
      </dl>

      {s && s.visits_unmeasurable > 0 && (
        // Said out loud rather than folded into the average: a one-event
        // session has no length, and quietly averaging it in as zero makes
        // every number above it look worse than the truth.
        <p className="text-[11.5px] leading-relaxed text-subtle">
          {s.visits_unmeasurable} of {s.visits} visits had a single event, so no length could be
          measured. They are excluded from the averages above, not counted as zero.
        </p>
      )}

      {/* ── The controls ─────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="text-[12.5px] font-medium text-fg">Change their standing</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-subtle">
          Everything here is written to the audit log with your name on it. The reason is what
          makes it answerable later, so it is required.
        </p>

        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why? e.g. Beta tester, comped 3 months"
          aria-label="Reason for this change"
          className="mt-2.5 w-full rounded-md border border-border bg-canvas px-2.5 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
        />

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Select
            value={months}
            onChange={setMonths}
            options={DURATIONS}
            ariaLabel="Pro duration"
            size="sm"
            tone="control"
          />
          <Button
            size="sm"
            disabled={busy || !reason.trim()}
            onClick={() =>
              void run(() =>
                setPlanLogged(user.user_id, true, reason, monthsFromNow(Number(months))),
              )
            }
          >
            {busy && <Loader2 size={13} className="mr-1 inline animate-spin" aria-hidden />}
            Grant Pro
          </Button>
          {isPro && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !reason.trim()}
              onClick={() => void run(() => setPlanLogged(user.user_id, false, reason, null))}
            >
              Revoke Pro
            </Button>
          )}
          <span className="w-full sm:w-auto" />
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !reason.trim()}
            onClick={() =>
              void run(() => setFlagsLogged(user.user_id, !user.is_internal, null, reason))
            }
          >
            {user.is_internal ? 'Not internal' : 'Mark internal'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !reason.trim()}
            onClick={() => void run(() => setFlagsLogged(user.user_id, null, !user.comped, reason))}
          >
            {user.comped ? 'Not comped' : 'Mark comped'}
          </Button>
        </div>
        {!reason.trim() && (
          <p className="mt-2 text-[11.5px] text-subtle">Type a reason to enable these.</p>
        )}
        {err && <p className="mt-2 text-[12px] text-danger">{err}</p>}
      </div>

      <UserMessagePanel userId={user.user_id} name={user.name} />

      {/* Notes stay exactly as they were — a scratchpad, not an audit trail. */}
      <div className="rounded-lg border border-border bg-surface p-3">
        <label className="text-[12.5px] font-medium text-fg">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Private scratchpad: VIP, spoke on Instagram, watching this one…"
          className="mt-1.5 w-full resize-y rounded-md border border-border bg-canvas px-2.5 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
        />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            disabled={busy || notes === (user.admin_notes ?? '')}
            onClick={() => void run(() => adminSetUserNotes(user.user_id, notes))}
          >
            Save notes
          </Button>
        </div>
      </div>

      {audit && audit.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-[12.5px] font-medium text-fg">Latest admin action</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            <span className="text-fg">{audit[0].action}</span> · {audit[0].reason}
          </p>
          <p className="mt-0.5 text-[11.5px] text-subtle">
            {audit[0].actor_email ?? 'unknown'} · {when(audit[0].created_at)}
          </p>
        </div>
      )}

      {showCourses && <CoursesPanel userId={user.user_id} onClose={() => setShowCourses(false)} />}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 sm:justify-start">
      <dt className="shrink-0 text-subtle">{label}</dt>
      <dd className="min-w-0 truncate text-fg sm:ml-auto">{value}</dd>
    </div>
  )
}
