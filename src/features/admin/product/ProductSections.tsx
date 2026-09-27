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

/**
 * The padded inside of a Panel.
 *
 * `Panel` draws only the frame and the header — every other admin tab pads
 * its own rows — and these sections assumed it padded for them, so bars,
 * tables and tiles ran into the card's border and the value column was cut
 * off at its right edge.
 */
function Body({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-4 p-4', className)}>{children}</div>
}

function Empty({ children = 'Nothing recorded in this range yet.' }: { children?: React.ReactNode }) {
  return <p className="py-6 text-center text-[12.5px] text-subtle">{children}</p>
}

/** One horizontal bar, as a share of a base. Zero draws nothing, not a sliver. */
function Bar({ name, value, base }: { name: string; value: number; base: number }) {
  const w = base > 0 && value > 0 ? Math.max(2, Math.round((value / base) * 100)) : 0
  return (
    <li className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_5.5rem] items-center gap-3 text-[12.5px]">
      <span className="truncate text-muted">{name}</span>
      <span className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <span className="block h-full rounded-full bg-accent" style={{ width: `${w}%` }} />
      </span>
      <span className="text-right whitespace-nowrap tabular-nums">
        <span className="font-medium text-fg">{value}</span>{' '}
        <span className="text-subtle">{pct(value, base)}</span>
      </span>
    </li>
  )
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return <Empty />
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full text-left text-[12.5px]">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={h}
                className={cn(
                  'pb-2 text-[10.5px] font-semibold tracking-wide whitespace-nowrap text-subtle uppercase',
                  i > 0 && 'pl-4 text-right',
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              {r.map((c, j) => (
                <td
                  key={j}
                  className={cn('py-2 whitespace-nowrap', j > 0 ? 'pl-4 text-right tabular-nums text-fg' : 'text-muted')}
                >
                  {c}
                </td>
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
      <Body>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Signups" value={String(a.signups)} />
          <Stat
            label="Course within 7 days"
            value={pct(a.aha_course_within_7d, a.signups)}
            hint={`${a.aha_course_within_7d} of ${a.signups} signups`}
          />
          <Stat
            label="Median time to first course"
            value={a.median_hours_to_first_course == null ? '—' : `${a.median_hours_to_first_course} h`}
          />
        </div>
        <ul className="flex flex-col gap-2.5">
          <Bar name="Signed up" value={a.signups} base={a.signups} />
          <Bar name="Finished onboarding" value={a.signup_completed} base={a.signups} />
          <Bar name="First course added" value={a.first_course_added} base={a.signups} />
          <Bar name="First assessment done" value={a.first_assignment_completed} base={a.signups} />
        </ul>
      </Body>
    </Panel>
  )
}

export function ChannelPanel({ r }: { r: ProductReport }) {
  return (
    <Panel title="Signup channels" sub="First touch, stored at signup. Aha = a course within 7 days.">
      <Body>
        <Table head={['Channel', 'Signups', 'Aha', 'Rate']} rows={r.channels.map((c) => [label(c.channel), c.signups, c.aha, pct(c.aha, c.signups)])} />
      </Body>
    </Panel>
  )
}

export function AdoptionPanel({ r }: { r: ProductReport }) {
  const mau = r.adoption.monthly_active
  return (
    <Panel title="Feature adoption" sub={`Share of the ${mau} monthly active users who used each feature in the last 30 days`}>
      <Body>
        <ul className="flex flex-col gap-2.5">
          {r.adoption.features.map((f) => (
            <Bar key={f.feature} name={FEATURE_LABEL[f.feature] ?? label(f.feature)} value={f.users} base={mau} />
          ))}
        </ul>
      </Body>
    </Panel>
  )
}

export function InvitePanel({ f }: { f: InviteFunnel }) {
  return (
    <Panel title="Club invite funnel" sub={f.definition}>
      <Body>
        <Table
          head={['Invite type', 'Sent', 'Opened', 'Claimed', 'Active club']}
          rows={f.modes.map((m) => [m.mode === 'prefilled' ? 'Handoff' : 'Self-setup', m.sent, `${m.opened} · ${pct(m.opened, m.sent)}`, `${m.claimed} · ${pct(m.claimed, m.sent)}`, `${m.org_active} · ${pct(m.org_active, m.sent)}`])}
        />
      </Body>
    </Panel>
  )
}

export function EmailPanel({ e }: { e: EmailReport }) {
  return (
    <Panel title="Email engagement" sub={e.note}>
      <Body>
        <Table
          head={['Template', 'Sent', 'Delivered', 'Opened', 'Clicked', 'Bounced', 'Spam']}
          rows={e.templates.map((t) => [label(t.template), t.sent, t.delivered, t.opened, t.clicked, t.bounced, t.complained])}
        />
      </Body>
    </Panel>
  )
}

export function ParsePanel({ p }: { p: ParseReport }) {
  return (
    <Panel title="Syllabus parsing" sub={p.note}>
      <Body>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Success rate" value={pct(p.succeeded, p.total)} hint={`${p.succeeded} of ${p.total} parses`} />
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <Table head={['File type', 'Total', 'OK']} rows={p.by_file_type.map((x) => [x.file_type, x.total, pct(x.succeeded, x.total)])} />
          <Table head={['Read path', 'Total', 'OK']} rows={p.by_read_path.map((x) => [x.read_path, x.total, pct(x.succeeded, x.total)])} />
          <Table head={['Failure reason', 'Count']} rows={p.failure_reasons.map((x) => [label(x.reason), x.count])} />
        </div>
      </Body>
    </Panel>
  )
}

/**
 * Retention as a shaded grid: each cell's tint is its share, so a cohort that
 * holds reads as a dark row and one that drops off fades, without reading
 * every number. Weeks a cohort has not reached yet are left blank.
 */
export function CohortPanel({ c }: { c: CohortReport }) {
  const width = Math.max(0, ...c.cohorts.map((x) => x.active.length))
  return (
    <Panel title="Weekly retention by signup week" sub={c.note}>
      <Body>
        {c.cohorts.length === 0 ? (
          <Empty />
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full border-separate border-spacing-1 text-[12px] tabular-nums">
              <thead>
                <tr className="text-[10.5px] font-semibold tracking-wide text-subtle uppercase">
                  <th className="pr-3 pb-1 text-left font-semibold whitespace-nowrap">Signup week</th>
                  <th className="pr-3 pb-1 text-right font-semibold">Size</th>
                  {Array.from({ length: width }, (_, i) => (
                    <th key={i} className="pb-1 text-center font-semibold">W{i}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.cohorts.map((x) => (
                  <tr key={x.week}>
                    <td className="pr-3 whitespace-nowrap text-muted">{x.week}</td>
                    <td className="pr-3 text-right text-fg">{x.size}</td>
                    {Array.from({ length: width }, (_, i) => {
                      if (i >= x.active.length) return <td key={i} />
                      const share = x.size > 0 ? x.active[i] / x.size : 0
                      return (
                        <td
                          key={i}
                          className="min-w-12 rounded-md px-2 py-1.5 text-center text-fg"
                          style={{ backgroundColor: `color-mix(in srgb, var(--ct-accent) ${Math.round(share * 55)}%, var(--ct-surface-2))` }}
                        >
                          {pct(x.active[i], x.size)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Body>
    </Panel>
  )
}

export function ChurnPanel({ c }: { c: ChurnReport }) {
  return (
    <Panel title="Churn" sub="Cancellations and deletions, and why when people said">
      <Body>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Cancellations scheduled" value={String(c.pro_cancel_scheduled)} />
          <Stat label="Subscriptions ended" value={String(c.pro_cancelled)} />
          <Stat label="Deletion requests" value={String(c.account_delete_requested)} />
          <Stat label="Accounts deleted" value={String(c.accounts_deleted)} />
        </div>
        <Table head={['Kind', 'Reason', 'Count']} rows={c.reasons.map((r) => [label(r.kind), label(r.reason), r.count])} />
        {c.recent.length > 0 && (
          <ul className="flex flex-col gap-2">
            {c.recent.map((r, i) => (
              <li key={i} className="rounded-lg border border-border px-3 py-2 text-[12.5px]">
                <span className="text-subtle">{label(r.kind)} · {r.reason ? label(r.reason) : 'no reason'} · {new Date(r.at).toLocaleDateString()}</span>
                <p className="mt-0.5 break-words text-fg">{r.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </Body>
    </Panel>
  )
}
