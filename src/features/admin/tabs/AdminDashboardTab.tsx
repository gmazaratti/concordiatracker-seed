import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  BookOpen,
  Bug,
  Building2,
  DollarSign,
  CalendarDays,
  ClipboardList,
  Crown,
  FileText,
  GraduationCap,
  Inbox,
  Lightbulb,
  Loader2,
  Users,
  type LucideIcon,
} from 'lucide-react'
import {
  adminActivityFeed,
  adminDashboardStats,
  adminRevenue,
  type ActivityItem,
  type DashboardStats,
  type RevenueStats,
} from '../admin-data'
import { cn } from '@/lib/cn'

/** Console Overview — at-a-glance stats, quick actions, and a recent-activity feed. */
export function AdminDashboardTab() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [revenue, setRevenue] = useState<RevenueStats | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        // Revenue is optional — a missing migration must not blank the page.
        const [s, a, rev] = await Promise.all([
          adminDashboardStats(),
          adminActivityFeed(),
          adminRevenue().catch(() => null),
        ])
        if (!active) return
        setStats(s)
        setActivity(a.items.slice(0, 12))
        setRevenue(rev)
      } catch (e) {
        if (active) setErr(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }
  if (err || !stats) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5 text-[13px] text-muted">
        Couldn&rsquo;t load the dashboard{err ? ` — ${err}` : ''}. If this persists, run{' '}
        <code className="rounded bg-surface-2 px-1 py-0.5 text-[12px]">db/admin_dashboard.sql</code> in Supabase.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[22px] font-semibold text-fg">Overview</h1>
        <p className="text-[13px] text-subtle">A pulse of the whole platform.</p>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={Users} label="Total users" value={stats.total_users} accent
          sub={`+${stats.new_users_7d} this week · +${stats.new_users_30d} this month`} />
        <Stat icon={Crown} label="Pro users" value={stats.pro_users} />
        <Stat icon={Activity} label="Activity (7d)" value={stats.activity_7d} sub="posts, events, edits" />
        <Stat icon={Inbox} label="Pending applications" value={stats.pending_applications}
          highlight={stats.pending_applications > 0} />
      </div>

      {revenue && <RevenuePanel r={revenue} />}

      {/* Quick actions */}
      <div>
        <h2 className="mb-2.5 text-[13px] font-semibold text-fg">Quick actions</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <Action to="/admin?tab=applications" icon={Inbox} label="Review applications"
            badge={stats.pending_applications || undefined} />
          <Action to="/admin?tab=portals" icon={Building2} label="Manage portals"
            badge={stats.pending_orgs || undefined} />
          <Action to="/admin?tab=survey" icon={ClipboardList} label="Survey results" />
          <Action to="/admin?tab=users" icon={Users} label="Users & plans" />
          <Action to="/teacher" icon={GraduationCap} label="Teacher portal" />
          <Action to="/organizer" icon={CalendarDays} label="Organizer portal" />
        </div>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={Building2} label="Organizations" value={stats.total_orgs}
          sub={stats.pending_orgs > 0 ? `${stats.pending_orgs} pending` : 'all reviewed'} />
        <Stat icon={CalendarDays} label="Events" value={stats.total_events} />
        <Stat icon={GraduationCap} label="Teachers" value={stats.total_teachers} />
        <Stat icon={BookOpen} label="Courses tracked" value={stats.total_courses} />
        <Stat icon={FileText} label="Assignments" value={stats.total_assignments} />
        <Stat icon={ClipboardList} label="Survey responses" value={stats.survey_responses} />
        <Stat icon={Lightbulb} label="Feature requests" value={stats.feature_requests} />
        <Stat icon={Bug} label="Bug reports" value={stats.open_bugs} />
      </div>

      {/* Recent activity */}
      <div>
        <h2 className="mb-2.5 text-[13px] font-semibold text-fg">Recent activity</h2>
        <div className="rounded-xl border border-border bg-surface">
          {activity.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-subtle">Nothing recent.</p>
          ) : (
            <ul className="divide-y divide-border">
              {activity.map((a) => (
                <li key={`${a.kind}-${a.id}`} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium tracking-wide text-subtle uppercase">
                    {a.kind}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-fg">{a.title}</p>
                    {a.subtitle && <p className="truncate text-[11.5px] text-subtle">{a.subtitle}</p>}
                  </div>
                  <span className="shrink-0 text-[11.5px] tabular-nums text-subtle">{ago(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

/** Estimated revenue, straight from mirrored Stripe subscription state. */
function RevenuePanel({ r }: { r: RevenueStats }) {
  const money = (cents: number) =>
    new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: (r.currency || 'cad').toUpperCase(),
      maximumFractionDigits: 0,
    }).format(cents / 100)

  return (
    <div>
      <h2 className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-fg">
        <DollarSign size={14} className="text-subtle" aria-hidden />
        Estimated revenue
      </h2>
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-[11.5px] font-medium text-subtle">Monthly run-rate</p>
            <p className="mt-1 text-[26px] leading-none font-semibold text-fg tabular-nums">
              {money(r.mrr_cents)}
            </p>
            <p className="mt-1 text-[11px] text-subtle">{money(r.arr_cents)} / year</p>
          </div>
          <div>
            <p className="text-[11.5px] font-medium text-subtle">Paying</p>
            <p className="mt-1 text-[26px] leading-none font-semibold text-fg tabular-nums">{r.paying}</p>
            <p className="mt-1 text-[11px] text-subtle">active subscriptions</p>
          </div>
          <div>
            <p className="text-[11.5px] font-medium text-subtle">On trial</p>
            <p className="mt-1 text-[26px] leading-none font-semibold text-accent tabular-nums">{r.trialing}</p>
            <p className="mt-1 text-[11px] text-subtle">+{money(r.trial_mrr_cents)}/mo if all convert</p>
          </div>
          <div>
            <p className="text-[11.5px] font-medium text-subtle">This period</p>
            <p className="mt-1 text-[26px] leading-none font-semibold text-fg tabular-nums">
              {money(r.period_cents)}
            </p>
            <p className="mt-1 text-[11px] text-subtle">billed across active plans</p>
          </div>
        </div>

        {(r.past_due > 0 || r.cancelling > 0 || r.comped > 0) && (
          <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-[12px]">
            {r.past_due > 0 && <span className="text-danger">{r.past_due} payment failed</span>}
            {r.cancelling > 0 && <span className="text-warning">{r.cancelling} cancelling at period end</span>}
            {r.comped > 0 && <span className="text-subtle">{r.comped} comped (gifted / reward)</span>}
          </div>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-subtle">
          Gross, before Stripe fees (~2.9% + $0.30 per charge). Trials aren’t counted as revenue
          until they’re charged. Stripe remains the source of truth.
          {r.missing_amounts > 0 &&
            ` ${r.missing_amounts} older subscription${r.missing_amounts === 1 ? '' : 's'} predate amount tracking and aren’t included yet.`}
        </p>
      </div>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  accent = false,
  highlight = false,
}: {
  icon: LucideIcon
  label: string
  value: number
  sub?: string
  accent?: boolean
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-surface p-3.5',
        highlight ? 'border-accent/50 bg-accent-soft/30' : 'border-border',
      )}
    >
      <div className={cn('flex items-center gap-1.5', accent ? 'text-accent' : 'text-subtle')}>
        <Icon size={14} aria-hidden />
        <span className="text-[11.5px] font-medium">{label}</span>
      </div>
      <p className="mt-1.5 text-[24px] font-semibold text-fg tabular-nums">{value.toLocaleString()}</p>
      {sub && <p className="text-[11px] text-subtle">{sub}</p>}
    </div>
  )
}

function Action({ to, icon: Icon, label, badge }: { to: string; icon: LucideIcon; label: string; badge?: number }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-3 text-[13px] font-medium text-fg transition-colors duration-150 hover:border-border-strong hover:bg-surface-2"
    >
      <Icon size={16} className="shrink-0 text-accent" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge ? (
        <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10.5px] font-bold text-accent-contrast tabular-nums">
          {badge}
        </span>
      ) : null}
    </Link>
  )
}

function ago(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}
