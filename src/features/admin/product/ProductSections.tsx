import { Panel, Stat } from '../admin-ui'
import { cn } from '@/lib/cn'
import { pct, type ChurnReport, type CohortReport, type EmailReport, type InviteFunnel, type ParseReport, type ProductReport } from './product-data'

const FEATURE_LABEL: Record<string, string> = {
  quick_links: 'Quick links',
  blueprint_preview: 'Blueprint preview',
  blueprint_import: 'Blueprint import',
  syllabus_upload: 'Syllabus upload',
  club_follow: 'Club follow',
  notifications_open: 'Notifications',
  calendar_sync: 'Calendar sync',
  moodle_connect: 'Moodle connect',
}

const label = (s: string | null | undefined) => (s ? s.replace(/_/g, ' ') : 'unknown')

/** One horizontal bar, as a share of a base. */
function Bar({ name, value, base, hint }: { name: string; value: number; base: number; hint?: string }) {
  const w = base > 0 ? Math.max(2, Math.round((value / base) * 100)) : 0
  return (
    <li className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-[12.5px]">
      <span className="truncate text-muted">{name}</span>
      <span className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <span className="block h-full rounded-full bg-accent" style={{ width: `${w}%` }} />
      </span>
      <span className="w-24 text-right tabular-nums text-fg">
        {value} <span className="text-subtle">{hint ?? pct(value, base)}</span>
      </span>
    </li>
  )
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return <p className="text-[12.5px] text-subtle">Nothing recorded in this range yet.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-[12.5px]">
        <thead>
          <tr className="text-subtle">
            {head.map((h, i) => (
              <th key={h} className={cn('pb-1.5 font-medium', i > 0 && 'text-right')}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              {r.map((c, j) => (
                <td key={j} className={cn('py-1.5', j > 0 ? 'text-right tabular-nums text-fg' : 'text-muted')}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ActivationPanel({ r }: { r: ProductReport }) {
  const a = r.activation
  return (
    <Panel
      title="Activation"
      sub={`Accounts created ${r.tracking_since ? 'since tracking began' : 'in range'} (internal and opted-out excluded)`}
    >
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Aha: course within 7 days" value={pct(a.aha_course_within_7d, a.signups)} hint={`${a.aha_course_within_7d} of ${a.signups}`} />
        <Stat label="Median time to first course" value={a.median_hours_to_first_course == null ? '·' : `${a.median_hours_to_first_course} h`} />
        <Stat label="Signups" value={String(a.signups)} />
      </div>
      <ul className="flex flex-col gap-2">
        <Bar name="Signed up" value={a.signups} base={a.signups} />
        <Bar name="Finished onboarding" value={a.signup_completed} base={a.signups} />
        <Bar name="First course added" value={a.first_course_added} base={a.signups} />
        <Bar name="First assessment done" value={a.first_assignment_completed} base={a.signups} />
      </ul>
    </Panel>
  )
}

export function ChannelPanel({ r }: { r: ProductReport }) {
  return (
    <Panel title="Signup channels" sub="First touch, stored at signup. Aha = a course within 7 days.">
      <Table head={['Channel', 'Signups', 'Aha', 'Aha rate']} rows={r.channels.map((c) => [label(c.channel), c.signups, c.aha, pct(c.aha, c.signups)])} />
    </Panel>
  )
}

export function AdoptionPanel({ r }: { r: ProductReport }) {
  const mau = r.adoption.monthly_active
  return (
    <Panel title="Feature adoption" sub={`Share of the ${mau} monthly active users who used each feature in the last 30 days`}>
      <ul className="flex flex-col gap-2">
        {r.adoption.features.map((f) => (
          <Bar key={f.feature} name={FEATURE_LABEL[f.feature] ?? label(f.feature)} value={f.users} base={mau} />
        ))}
      </ul>
    </Panel>
  )
}

export function InvitePanel({ f }: { f: InviteFunnel }) {
  return (
    <Panel title="Club invite funnel" sub={f.definition}>
      <Table
        head={['Invite type', 'Sent', 'Opened', 'Claimed', 'Active club']}
        rows={f.modes.map((m) => [m.mode === 'prefilled' ? 'Handoff (prefilled)' : 'Self-setup', m.sent, `${m.opened} (${pct(m.opened, m.sent)})`, `${m.claimed} (${pct(m.claimed, m.sent)})`, `${m.org_active} (${pct(m.org_active, m.sent)})`])}
      />
    </Panel>
  )
}

export function EmailPanel({ e }: { e: EmailReport }) {
  return (
    <Panel title="Email engagement" sub={e.note}>
      <Table
        head={['Template', 'Sent', 'Delivered', 'Opened', 'Clicked', 'Bounced', 'Spam']}
        rows={e.templates.map((t) => [label(t.template), t.sent, t.delivered, t.opened, t.clicked, t.bounced, t.complained])}
      />
    </Panel>
  )
}

export function ParsePanel({ p }: { p: ParseReport }) {
  return (
    <Panel title="Syllabus parsing" sub={p.note}>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Success rate" value={pct(p.succeeded, p.total)} hint={`${p.succeeded} of ${p.total}`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Table head={['File type', 'Total', 'OK']} rows={p.by_file_type.map((x) => [x.file_type, x.total, pct(x.succeeded, x.total)])} />
        <Table head={['Read path', 'Total', 'OK']} rows={p.by_read_path.map((x) => [x.read_path, x.total, pct(x.succeeded, x.total)])} />
        <Table head={['Failure reason', 'Count']} rows={p.failure_reasons.map((x) => [label(x.reason), x.count])} />
      </div>
    </Panel>
  )
}

export function CohortPanel({ c }: { c: CohortReport }) {
  const width = Math.max(0, ...c.cohorts.map((x) => x.active.length))
  return (
    <Panel title="Weekly retention by signup week" sub={c.note}>
      <Table
        head={['Signup week', 'Size', ...Array.from({ length: width }, (_, i) => `W${i}`)]}
        rows={c.cohorts.map((x) => [x.week, x.size, ...Array.from({ length: width }, (_, i) => (i < x.active.length ? pct(x.active[i], x.size) : ''))])}
      />
    </Panel>
  )
}

export function ChurnPanel({ c }: { c: ChurnReport }) {
  return (
    <Panel title="Churn" sub="Cancellations and deletions, and why when people said">
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Cancellations scheduled" value={String(c.pro_cancel_scheduled)} />
        <Stat label="Subscriptions ended" value={String(c.pro_cancelled)} />
        <Stat label="Deletion requests" value={String(c.account_delete_requested)} />
        <Stat label="Accounts deleted" value={String(c.accounts_deleted)} />
      </div>
      <Table head={['Kind', 'Reason', 'Count']} rows={c.reasons.map((r) => [label(r.kind), label(r.reason), r.count])} />
      {c.recent.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {c.recent.map((r, i) => (
            <li key={i} className="rounded-lg border border-border px-3 py-2 text-[12.5px]">
              <span className="text-subtle">{label(r.kind)} · {r.reason ? label(r.reason) : 'no reason'} · {new Date(r.at).toLocaleDateString()}</span>
              <p className="mt-0.5 break-words text-fg">{r.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
