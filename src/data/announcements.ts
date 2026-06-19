/**
 * Cross-course teacher announcements — the student's OWN coursework, so this
 * lives on TODAY (a quiet academic-glance digest), not Community (which is
 * outward-facing, beyond your own courses). The course detail is the source of
 * truth; the digest just aggregates a recent glance and links back.
 *
 * Backed by the `announcements` table (Phase 9), loaded through `TeacherProvider`.
 * Keyed by COURSE CODE — a teacher and a student hold different per-user course
 * ids, so the code is the shared match key (like blueprints).
 */
export interface Announcement {
  id: string
  /** The course CODE this is for (e.g. "COMM 217") — the cross-user match key. */
  courseCode: string
  title: string
  /** Short snippet shown in the digest. */
  body: string
  postedDaysAgo: number
  /** Set when a teacher edits it → drives the "Edited" tag + when, shown to
   * students and teachers alike. Undefined = never edited. */
  editedDaysAgo?: number
}

const POSTED_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

/** Absolute posted/edited date, e.g. "Jun 15". */
export function postedOn(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - Math.max(0, daysAgo))
  return POSTED_FMT.format(d)
}

/** "today" / "yesterday" / "3d ago" — for the relative "Edited …" label. */
export function agoLabel(daysAgo: number): string {
  if (daysAgo <= 0) return 'today'
  if (daysAgo === 1) return 'yesterday'
  return `${daysAgo}d ago`
}

// (The seed announcements now live in the `announcements` table — db/phase9_teacher.sql.)
