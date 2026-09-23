/**
 * The programme list and the map-link rule.
 *
 * A PLAIN MODULE, not the component file: a `.tsx` that exports a component
 * AND a function loses fast refresh, which is a trap this repo has hit enough
 * times to have a rule about. `mapLinkProblem` is also pure, so it can be
 * tested without a DOM.
 */
/**
 * THE PROGRAM LIST IS FIXED, and that is the point rather than a limitation.
 * "For your program" matches an event's tags against what a student put in
 * their profile, so a typed box makes the two halves of one feature disagree:
 * "Comp Sci", "COMP SCI" and "Computer Science" are three tags and one
 * programme, and every one of them is a silent miss for somebody.
 *
 * `Everyone` is first and is not a programme — it is the absence of a filter,
 * and having to express that by leaving a box empty is how clubs ended up
 * tagging events with nothing and wondering why nobody saw them.
 */
export const PROGRAM_CHIPS = [
  'Everyone',
  'Computer Science',
  'Software Engineering',
  'Engineering',
  'Finance',
  'Accounting',
  'Marketing',
  'Management',
  'Economics',
  'Psychology',
  'Political Science',
  'Communications',
  'Fine Arts',
  'Biology',
  'Journalism',
] as const

const MAP_HOSTS = [
  'google.com',
  'maps.google.com',
  'goo.gl',
  'maps.app.goo.gl',
  'openstreetmap.org',
  'apple.com',
  'maps.apple.com',
]

export function mapLinkProblem(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  let u: URL
  try {
    u = new URL(v)
  } catch {
    return 'That does not look like a link.'
  }
  if (u.protocol !== 'https:') return 'Use an https:// link.'
  const host = u.hostname.replace(/^www\./, '')
  if (!MAP_HOSTS.some((h) => host === h || host.endsWith('.' + h))) {
    return 'Use a Google Maps, Apple Maps or OpenStreetMap link.'
  }
  return null
}
