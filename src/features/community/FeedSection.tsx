import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Heart,
  Lightbulb,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Tag,
  UserPlus,
  UserRoundCheck,
  type LucideIcon,
} from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useTeacher } from '@/app/providers/teacher'
import { useFollows } from '@/app/providers/follows'
import {
  listCommentCounts,
  listFeatureRequests,
  listReactions,
  totalReactions,
  type FeatureRequest,
  type ReactionRow,
} from '@/features/feedback/feedback-data'
import { markNotificationsRead } from '@/lib/notifications'
import { normalizeCode } from '@/lib/supabase-adapters'
import { localized } from '@/lib/localized'
import { useI18n } from '@/i18n/i18n'
import { CourseChip } from '@/components/CourseChip'
import { Mascot } from '@/components/Mascot'
import { courseColor } from '@/lib/course-color'
import { cn } from '@/lib/cn'
import type { Course } from '@/data/types'
import { orgSlug } from '@/data/community'
import { useCommunity } from './useCommunity'
import { useActivityFeed } from './useActivityFeed'
import { suggestOrgs } from './feed'
import { OrgLogo } from './OrgLogo'
import { VerifiedBadge } from './VerifiedBadge'
import { FollowButton } from './FollowButton'

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

/**
 * Feed — what came in, newest first.
 *
 * NO EVENTS IN HERE. They used to be the entire feed and they were the wrong
 * content: there is an Events tab two slots along, sorted by when things START
 * and filtered by category. Repeating them here sorted by posting date meant
 * the same cards twice with no way to tell which list you were looking at —
 * the same duplicate-surface fault that once gave this page two search fields
 * and two avatars. A feed answers "what happened since I last looked"; a
 * directory answers "what is on". Only one of those needed building twice.
 *
 * What is left is inbound and lives nowhere else: a professor posting to a
 * class you are in, a reply to you, a follow, movement on the suggestions
 * board. Every row is something a PERSON did — that is the test for belonging
 * here, and it is why your own deadlines are not in it (Today owns those).
 *
 * STILL NOT A SOCIAL NETWORK: nobody can post into this and there is nothing
 * to like. See the note on `SuggestionRow` for the one row that already is
 * social, and which is where a social layer would grow from if it ever does.
 */
type Row =
  | {
      kind: 'announce'
      id: string
      at: number
      course: Course
      author: string
      title: string
      body: string
      edited: boolean
    }
  | {
      kind: 'note'
      id: string
      at: number
      notificationId?: string
      title: string
      body: string | null
      href: string
      icon: LucideIcon
      unread: boolean
    }
  | { kind: 'suggestion'; id: string; at: number; req: FeatureRequest }

export function FeedSection({
  requests,
  onOpenActivity,
}: {
  requests: number
  onOpenActivity: () => void
}) {
  const { courses } = useAppData()
  const { teacherAnnouncements } = useTeacher()
  const { lang } = useI18n()
  const { orgs, events } = useCommunity()
  const { isFollowing, followedHandles } = useFollows()
  const { items: activity, loading } = useActivityFeed()
  const [board, setBoard] = useState<FeatureRequest[]>([])
  const [reactions, setReactions] = useState<ReactionRow[]>([])
  const [comments, setComments] = useState<Map<string, number>>(new Map())
  // Read the clock ONCE, as the activity hook does: a list that re-derives
  // "how long ago" on every render reorders itself while you are reading it.
  const [now] = useState(() => Date.now())

  useEffect(() => {
    let alive = true
    void Promise.all([listFeatureRequests(), listReactions(), listCommentCounts()])
      .then(([r, x, c]) => {
        if (!alive) return
        setBoard(r)
        setReactions(x)
        setComments(c)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const courseByCode = useMemo(() => {
    const m = new Map<string, Course>()
    for (const c of courses) if (c.code) m.set(normalizeCode(c.code), c)
    return m
  }, [courses])

  const rows = useMemo(() => {
    const out: Row[] = []

    // Classes you are in, matched on course CODE — a professor posts once and
    // every section of that class sees it, which is why the code is the key
    // and not a per-user course id.
    for (const a of teacherAnnouncements) {
      const course = courseByCode.get(a.courseCode)
      if (!course) continue
      out.push({
        kind: 'announce',
        id: `an-${a.id}`,
        at: now - a.postedDaysAgo * DAY,
        course,
        author: course.instructor.name || 'Your instructor',
        title: localized(a, lang, 'title'),
        body: localized(a, lang, 'body'),
        edited: a.editedDaysAgo != null,
      })
    }

    // Everything the bell knows, minus two things: events (see above) and
    // connection requests, which are a decision rather than news and get the
    // actionable card at the top instead of a line in a river.
    for (const it of activity) {
      if (it.kind === 'event' || it.kind === 'request') continue
      if (it.kind === 'accepted') {
        out.push({
          kind: 'note',
          id: it.id,
          at: it.at,
          title: `You and ${it.friend.name || it.friend.handle} are connected`,
          body: null,
          href: `/app/community?c=messages&chat=${it.friend.handle}`,
          icon: UserRoundCheck,
          unread: false,
        })
      } else if (it.kind === 'messages') {
        out.push({
          kind: 'note',
          id: it.id,
          at: it.at,
          title: it.count === 1 ? '1 unread message' : `${it.count} unread messages`,
          body: null,
          href: '/app/community?c=messages',
          icon: MessageSquare,
          unread: true,
        })
      } else {
        out.push({
          kind: 'note',
          id: it.id,
          at: it.at,
          notificationId: it.n.id,
          title: it.n.title,
          body: it.n.body,
          href: inApp(it.n.link),
          icon: it.n.kind === 'follow' ? UserPlus : Tag,
          unread: !it.n.read_at,
        })
      }
    }

    for (const r of board.slice(0, 5)) {
      out.push({
        kind: 'suggestion',
        id: `fr-${r.id}`,
        at: new Date(r.created_at).getTime(),
        req: r,
      })
    }

    return out.sort((a, b) => b.at - a.at).slice(0, 30)
  }, [teacherAnnouncements, courseByCode, activity, board, now, lang])

  const orgSuggestions = useMemo(
    () => suggestOrgs(orgs, events, isFollowing, 3),
    [orgs, events, isFollowing],
  )

  return (
    <div className="mx-auto w-full max-w-2xl">
      {requests > 0 && (
        <button
          type="button"
          onClick={onOpenActivity}
          className="mb-3 flex w-full items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft px-3.5 py-3 text-left transition-colors duration-150 hover:border-accent"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
            <UserPlus size={16} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium text-fg">
              {requests === 1 ? 'Someone wants to connect' : `${requests} people want to connect`}
            </span>
            <span className="block text-[12px] text-subtle">Review the requests</span>
          </span>
          <ArrowRight size={15} className="shrink-0 text-accent" aria-hidden />
        </button>
      )}

      {/* The quicker way in, asked for by name: one line, always present, so
          the board is never more than a tap from the screen you land on. */}
      <Link
        to="/app/requests"
        className="mb-4 flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-2.5 transition-colors duration-150 hover:border-accent"
      >
        <Lightbulb size={15} className="shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1 text-[13px] text-fg">Suggestions board</span>
        <span className="shrink-0 text-[12px] text-subtle">
          {board.length > 0 ? `${board.length} open` : 'Ask for something'}
        </span>
        <ArrowRight size={14} className="shrink-0 text-subtle" aria-hidden />
      </Link>

      {orgSuggestions.length > 0 && followedHandles.length < 3 && (
        <FollowSuggestions orgs={orgSuggestions} />
      )}

      {loading && rows.length === 0 ? (
        <p className="px-1 py-10 text-center text-[13px] text-subtle">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-5 py-14 text-center">
          <Mascot mood="resting" size="sm" soft className="text-accent" />
          <p className="text-[13.5px] font-medium text-fg">Nothing new</p>
          <p className="max-w-xs text-[12.5px] leading-relaxed text-subtle">
            Posts from your professors, replies, and anything that happens to your
            suggestions land here.
          </p>
        </div>
      ) : (
        /* One river, hairline-separated. Cards with their own borders and gaps
           read as a dashboard; a feed is a single column of rows. */
        <ul className="divide-y divide-border border-y border-border">
          {rows.map((row) => (
            <li key={row.id}>
              {row.kind === 'announce' ? (
                <AnnouncementRow row={row} now={now} />
              ) : row.kind === 'note' ? (
                <NoteRow row={row} now={now} />
              ) : (
                <SuggestionRow
                  req={row.req}
                  at={row.at}
                  now={now}
                  hearts={totalReactions(reactions, row.req.id)}
                  comments={comments.get(row.req.id) ?? 0}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Keep a notification link inside the app shell where an in-app route exists
 *  for it. The triggers write `/feedback?request=…` because that link also has
 *  to work from an email; a signed-in student tapping it here should not lose
 *  the sidebar. */
function inApp(link: string | null): string {
  if (!link) return '/app/community?activity=1'
  return link.startsWith('/feedback') ? `/app/requests${link.slice('/feedback'.length)}` : link
}

/** Relative time, from a fixed `now` so it stays pure. */
function ago(at: number, now: number): string {
  const d = Math.max(0, now - at)
  if (d < MINUTE) return 'now'
  if (d < HOUR) return `${Math.floor(d / MINUTE)}m`
  if (d < DAY) return `${Math.floor(d / HOUR)}h`
  if (d < 7 * DAY) return `${Math.floor(d / DAY)}d`
  if (d < 30 * DAY) return `${Math.floor(d / (7 * DAY))}w`
  return `${Math.floor(d / (30 * DAY))}mo`
}

function RowShell({
  to,
  onClick,
  avatar,
  children,
}: {
  to: string
  onClick?: () => void
  avatar: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex gap-3 px-1 py-3.5 transition-colors duration-150 hover:bg-surface/60 sm:px-3"
    >
      <span className="shrink-0">{avatar}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </Link>
  )
}

/** A professor posting to a class you are in — the only row here that is about
 *  your coursework, and the reason it leads with the course, not a face. */
function AnnouncementRow({ row, now }: { row: Extract<Row, { kind: 'announce' }>; now: number }) {
  const { hex } = courseColor(row.course.color)
  return (
    <RowShell
      to={`/app/courses/${row.course.id}`}
      avatar={
        <span
          className="grid size-9 place-items-center rounded-full"
          style={{ backgroundColor: `${hex}22`, color: hex }}
        >
          <Megaphone size={16} aria-hidden />
        </span>
      }
    >
      <span className="flex items-center gap-1.5 text-[12.5px]">
        <span className="truncate font-medium text-fg">{row.author}</span>
        <CourseChip code={row.course.code} color={row.course.color} />
        <span className="shrink-0 text-subtle">· {ago(row.at, now)}</span>
        {row.edited && <span className="shrink-0 text-subtle">· edited</span>}
      </span>
      <span className="mt-1 block text-[14px] leading-snug font-medium text-fg">{row.title}</span>
      {row.body && (
        <span className="mt-0.5 line-clamp-3 text-[12.5px] leading-relaxed text-muted">
          {row.body}
        </span>
      )}
    </RowShell>
  )
}

function NoteRow({ row, now }: { row: Extract<Row, { kind: 'note' }>; now: number }) {
  const Icon = row.icon
  const [read, setRead] = useState(!row.unread)
  return (
    <RowShell
      to={row.href}
      /* READ ONE, NOT ALL. Scrolling past a river is not reading it, so the
         feed never clears the bell wholesale the way the panel does — only
         the row you actually opened. */
      onClick={() => {
        if (row.notificationId && !read) {
          setRead(true)
          void markNotificationsRead([row.notificationId])
        }
      }}
      avatar={
        <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-accent">
          <Icon size={16} aria-hidden />
        </span>
      }
    >
      <span className="flex items-start gap-1.5">
        <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-fg">
          {row.title}
          <span className="text-subtle"> · {ago(row.at, now)}</span>
        </span>
        {!read && (
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />
        )}
      </span>
      {row.body && (
        <span className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted">
          {row.body}
        </span>
      )}
    </RowShell>
  )
}

/** A profile picture that can fail. A hotlinked avatar that 404s renders as an
 *  empty dark circle, which reads as a broken feed rather than a missing
 *  photo — so a failed load falls back to initials, the same rule `OrgLogo`
 *  and the event banners already follow. */
function Avatar({ url, initials }: { url: string | null; initials: string }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed) {
    return (
      <span className="grid size-9 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-muted">
        {initials}
      </span>
    )
  }
  return (
    <img
      src={url}
      alt=""
      onError={() => setFailed(true)}
      className="size-9 rounded-full bg-surface-2 object-cover"
    />
  )
}

const STATUS_TONE: Record<string, string> = {
  planned: 'text-info',
  'in-progress': 'text-warning',
  shipped: 'text-success',
  declined: 'text-subtle',
}

/**
 * Something another student asked for, with the activity on it.
 *
 * THIS IS THE ONE ROW THAT IS ALREADY SOCIAL — a real name, their own words,
 * and people replying underneath. The counts are shown but not operable here:
 * reacting and replying happen on the board, where the thread is, and a heart
 * you can tap in a feed with no thread under it is a like button in search of
 * a product.
 */
function SuggestionRow({
  req,
  at,
  now,
  hearts,
  comments,
}: {
  req: FeatureRequest
  at: number
  now: number
  hearts: number
  comments: number
}) {
  const initials = req.author_name.slice(0, 2).toUpperCase()
  return (
    <RowShell
      to={`/app/requests?request=${req.id}`}
      avatar={<Avatar url={req.author_avatar} initials={initials} />}
    >
      <span className="flex items-center gap-1.5 text-[12.5px]">
        <span className="truncate font-medium text-fg">{req.author_name}</span>
        {req.author_handle && <span className="truncate text-subtle">@{req.author_handle}</span>}
        <span className="shrink-0 text-subtle">· {ago(at, now)}</span>
        {req.status !== 'open' && (
          <span className={cn('ml-auto shrink-0 font-medium capitalize', STATUS_TONE[req.status])}>
            {req.status}
          </span>
        )}
      </span>
      <span className="mt-1 block text-[14px] leading-snug font-medium text-fg">{req.title}</span>
      {req.body && (
        <span className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted">
          {req.body}
        </span>
      )}
      <span className="mt-2 flex items-center gap-4 text-[12px] text-subtle">
        <span className="inline-flex items-center gap-1">
          <Heart size={13} aria-hidden />
          {hearts}
          <span className="sr-only">reactions</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle size={13} aria-hidden />
          {comments}
          <span className="sr-only">{comments === 1 ? 'reply' : 'replies'}</span>
        </span>
      </span>
    </RowShell>
  )
}

/** Orgs worth following — shown only while you follow almost nothing, because
 *  an empty feed with no way out of it is a dead end. */
function FollowSuggestions({ orgs }: { orgs: ReturnType<typeof suggestOrgs> }) {
  return (
    <section className="mb-4">
      <h2 className="mb-2 px-1 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        Follow a few clubs
      </h2>
      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {orgs.map((org) => (
          <li key={org.handle} className="flex items-center gap-3 px-3 py-2.5">
            <Link to={`/app/community/org/${orgSlug(org)}`} className="min-w-0 flex-1">
              <span className="flex items-center gap-2.5">
                <OrgLogo org={org} className="size-9 shrink-0" rounded="rounded-full" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-[13px] font-medium text-fg">
                    <span className="truncate">{org.name}</span>
                    {org.verified && <VerifiedBadge size={13} />}
                  </span>
                  <span className="block truncate text-[12px] text-subtle">{org.handle}</span>
                </span>
              </span>
            </Link>
            <FollowButton handle={org.handle} size="sm" />
          </li>
        ))}
      </ul>
    </section>
  )
}
