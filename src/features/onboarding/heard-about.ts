/** Attribution sources for the onboarding "how'd you find us?" step. Data-only
 * (no JSX) so both the slide and the admin attribution view can share the labels
 * + order without a fast-refresh lint complaint. */
export interface HeardSource {
  id: string
  label: string
}

export const HEARD_SOURCES: HeardSource[] = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'reddit', label: 'Reddit' },
  { id: 'friend', label: 'A friend' },
  { id: 'teacher', label: 'A prof or TA' },
  { id: 'search', label: 'Google search' },
  { id: 'club', label: 'A club or event' },
  { id: 'other', label: 'Somewhere else' },
]

export const HEARD_LABELS: Record<string, string> = Object.fromEntries(
  HEARD_SOURCES.map((s) => [s.id, s.label]),
)
