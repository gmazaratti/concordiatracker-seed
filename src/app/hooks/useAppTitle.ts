import { useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useActivityBadge } from '@/app/usePeopleBadge'
import { DEFAULT_SECTION, isCommunitySection } from '@/features/community/sections'

/**
 * What the browser tab says while you are inside the app.
 *
 * ONE PLACE, not a call on every page. Every signed-in route was showing the
 * site-wide marketing title from index.html — "ConcordiaTracker — GPA,
 * Syllab…" truncated in every tab — because `usePageMeta` is an SEO tool that
 * only the public pages call, and rightly so: a tab title is not a canonical
 * URL and an app screen has no business rewriting `og:description`. Deriving
 * it from the route here means a new screen gets a correct title without
 * anyone remembering to add one, and the fallback is the product name rather
 * than the wrong page's name.
 *
 * THE COUNT GOES IN FRONT, in brackets, because that is the one part of a
 * title that is legible in a 120px tab strip. It is the SAME number the bell
 * shows — messages plus notifications — so a tab claiming one waiting thing
 * and a badge claiming another can never happen.
 *
 * Effects run child-first, so this one (on the layout) settles after any page
 * that also writes `document.title`, and the layout wins deterministically.
 */

const BRAND = 'ConcordiaTracker'

/** Longest prefix wins, so `/app/courses/blueprints` beats `/app/courses`. */
const ROUTES: [prefix: string, name: string][] = [
  ['/app/courses/blueprints', 'Outlines'],
  ['/app/courses/upload', 'Upload a syllabus'],
  ['/app/courses', 'Courses'],
  ['/app/calendar', 'Calendar'],
  ['/app/planner', 'Planner'],
  ['/app/community/notifications', 'Notifications'],
  ['/app/community/following', 'Following'],
  ['/app/community/org', 'Organization'],
  ['/app/community', 'Social'],
  ['/app/requests', 'Feature requests'],
  ['/app', 'Today'],
]

const PLANNER_TABS: Record<string, string> = {
  record: 'My record',
  program: 'My programme',
  directory: 'Course directory',
  prereq: 'Prerequisites',
  saved: 'Saved schedules',
  schedule: 'Schedule builder',
  seats: 'Seat watch',
  radar: 'Radar',
  money: 'Costs',
}

const SOCIAL_SECTIONS: Record<string, string> = {
  feed: 'Feed',
  events: 'Events',
  messages: 'Messages',
  profile: 'Your profile',
}

/**
 * ONE NAME, NOT A TRAIL. "Messages · Social" is truthful and the half a tab
 * strip shows is "Messages · Soc…", which is worse than "Messages": the part
 * that survives truncation should be the part that identifies the tab. The
 * section names are already unambiguous on their own.
 */
function pageName(pathname: string, params: URLSearchParams): string | null {
  // Not an app route — a public profile rendered inside the shell, say. Those
  // set their own title through usePageMeta and it should stand.
  if (!pathname.startsWith('/app')) return null

  const hit = ROUTES.find(([p]) => pathname === p || pathname.startsWith(`${p}/`))
  if (!hit) return null
  const [prefix, name] = hit

  if (prefix === '/app/planner') {
    const tab = params.get('tab')
    return tab && PLANNER_TABS[tab] ? PLANNER_TABS[tab] : name
  }
  if (prefix === '/app/community') {
    const raw = params.get('c')
    const section = isCommunitySection(raw) ? raw : DEFAULT_SECTION
    return SOCIAL_SECTIONS[section]
  }
  return name
}

export function useAppTitle(): void {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const waiting = useActivityBadge()

  const name = pageName(pathname, params)

  useEffect(() => {
    if (!name) return
    const count = waiting > 9 ? '9+' : waiting
    document.title = waiting > 0 ? `(${count}) ${BRAND} - ${name}` : `${BRAND} - ${name}`
  }, [name, waiting])
}
