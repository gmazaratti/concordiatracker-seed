import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ExternalLink, Heart, MessageCircle, Newspaper, Plus, RotateCcw, UserCog, UserPlus, Users } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { orgSlug } from '@/data/community'
import { startOfToday } from '@/lib/date'
import { Panel } from '@/features/admin/admin-ui'
import { Segmented } from '@/features/settings/controls'
import { ActionCard, SeeAll, SetupChecklist, UpcomingRow, type SetupStep } from './overview/OverviewParts'
import { GrowthPanel, KpiCard } from './overview/OverviewCharts'
import { TopPosts } from './overview/TopPosts'
import { delta, sum, useOrgSeries, type SeriesKey } from './overview/use-org-series'

type Range = '7' | '30' | '90'

/**
 * `/organizer` — how the club is doing, drawn.
 *
 * The admin overview's shape on purpose: numbers with their trend first, one
 * chart you can re-point at a metric, and the lists that explain them beside
 * it. Every figure is a count of real rows on real days (follows, posts,
 * likes, comments, published events) — a real club has no view tracking, and
 * a chart of estimates would be the most confident-looking wrong thing on
 * the portal.
 *
 * Setup and quick actions stay, below the numbers once a club is running and
 * above them while it is still getting set up.
 */
export function OrganizerOverview({ onReplaySetup }: { onReplaySetup?: () => void }) {
  const { currentOrg, createEvent, orgViewerPerms: perms } = useTeacher()
  const navigate = useNavigate()
  const [range, setRange] = useState<Range>('30')
  const days = Number(range)
  const { current, previous } = useOrgSeries(currentOrg?.id, days)
  if (!currentOrg) return null

  const { org, events, members, status } = currentOrg
  const pending = status === 'pending'
  const now = startOfToday().getTime()
  const live = events.filter((e) => !e.isDraft)
  const upcoming = live
    .filter((e) => new Date(e.start).getTime() >= now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 4)

  function newEvent() {
    navigate(`/organizer/event/${createEvent()}`)
  }

  const steps: SetupStep[] = [
    { done: !!org.bio?.trim(), label: 'Complete your profile', hint: 'Add a bio, logo, and links', to: '/organizer/profile' },
    { done: live.length > 0, label: 'Post your first event', hint: 'Reach students in Community', onClick: newEvent },
    { done: members.length > 1, label: 'Invite your team', hint: 'Share the dashboard with co-organizers', to: '/organizer/team' },
  ]
  const setupDone = steps.every((s) => s.done)
  const spark = (k: SeriesKey) => (current ?? []).map((r) => ({ day: r.day, value: r[k] }))
  const followers = current?.at(-1)?.followers ?? 0
  const period = `vs previous ${days} days`

  const actions = (
    <section>
      <h2 className="mb-3 text-[11px] font-semibold tracking-wide text-subtle uppercase">Quick actions</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {perms.manage_events && <ActionCard icon={Plus} label="New event" sub="Starts as a draft" onClick={newEvent} accent />}
        {perms.edit_profile && <ActionCard icon={UserCog} label="Edit profile" sub="Bio, logo, links" to="/organizer/profile" />}
        {perms.manage_team && <ActionCard icon={Users} label="Invite team" sub="Share the dashboard" to="/organizer/team" />}
        {status === 'approved' ? (
          <ActionCard icon={ExternalLink} label="Public profile" sub="See what students see" to={`/app/community/org/${orgSlug(org)}`} />
        ) : (
          <ActionCard icon={ExternalLink} label="Public profile" sub="Live after approval" disabled />
        )}
      </div>
    </section>
  )

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] leading-tight font-semibold text-fg">Overview</h1>
          <p className="text-[13px] text-subtle">How {org.name} is doing.</p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            ariaLabel="Time range"
            value={range}
            onChange={setRange}
            options={[
              { value: '7', label: '7 days' },
              { value: '30', label: '30 days' },
              { value: '90', label: '90 days' },
            ]}
          />
          {onReplaySetup && (
            <button
              type="button"
              onClick={onReplaySetup}
              title="Replay setup"
              aria-label="Replay setup"
              className="grid size-8 place-items-center rounded-lg border border-border text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
            >
              <RotateCcw size={14} aria-hidden />
            </button>
          )}
        </div>
      </header>

      {pending && (
        <div className="mb-5 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-warning">
          <strong className="font-semibold">Waiting on us, not on you.</strong> Set up your profile and
          draft your events now — nothing is lost. We check new organizations by hand, and you'll get
          an email the moment yours is approved; everything you've published goes live then.
        </div>
      )}

      <div className="flex flex-col gap-5">
        {!setupDone && <SetupChecklist steps={steps} />}
        {!setupDone && actions}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard icon={UserPlus} label="Followers" value={followers} sub={`+${sum(current, 'newFollowers')} in ${days} days`} change={delta(sum(current, 'newFollowers'), sum(previous, 'newFollowers'))} points={current?.map((r) => ({ day: r.day, value: r.followers })) ?? []} />
          <KpiCard icon={Heart} label="Likes" value={sum(current, 'likes')} sub={period} change={delta(sum(current, 'likes'), sum(previous, 'likes'))} points={spark('likes')} />
          <KpiCard icon={MessageCircle} label="Comments" value={sum(current, 'comments')} sub={period} change={delta(sum(current, 'comments'), sum(previous, 'comments'))} points={spark('comments')} />
          <KpiCard icon={Newspaper} label="Posts" value={sum(current, 'posts')} sub={period} change={delta(sum(current, 'posts'), sum(previous, 'posts'))} points={spark('posts')} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <GrowthPanel rows={current} days={days} />
          <div className="flex min-w-0 flex-col gap-5">
            <Panel
              title="Coming up"
              sub={upcoming.length ? `${upcoming.length} next` : 'Nothing scheduled'}
              action={live.length > 0 ? <SeeAll to="/organizer/events" label="All events" /> : undefined}
            >
              {upcoming.length === 0 ? (
                <button
                  type="button"
                  onClick={newEvent}
                  disabled={!perms.manage_events}
                  className="m-4 flex w-[calc(100%-2rem)] items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong px-4 py-6 text-[13px] font-medium text-muted transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-50"
                >
                  <CalendarDays size={16} aria-hidden />
                  Plan the next one
                </button>
              ) : (
                <ul className="flex flex-col gap-2 p-3">
                  {upcoming.map((e) => (
                    <UpcomingRow key={e.id} event={e} />
                  ))}
                </ul>
              )}
            </Panel>
            <TopPosts orgId={currentOrg.id} org={org} />
          </div>
        </div>

        {setupDone && actions}
      </div>
    </div>
  )
}
