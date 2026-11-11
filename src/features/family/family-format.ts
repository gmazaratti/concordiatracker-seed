const DAY = 86_400_000

/**
 * "Weekly Quiz 1 (Lessons 1 & 2) - Only 8 best quizzes count towards final grade"
 * is a name AND a rule. Shown on one line they crowd every row into a wall of
 * text, so the part after the first " - " becomes a quiet second line.
 */
export function splitTitle(title: string): { name: string; note: string | null } {
  const i = title.indexOf(' - ')
  if (i < 4) return { name: title, note: null }
  return { name: title.slice(0, i).trim(), note: title.slice(i + 3).trim() || null }
}

/** A short, never-wrapping due label: "Due Fri", "Nov 21", "18 days late". */
export function dueLabel(due: string | null, now: number): { text: string; tone: 'late' | 'soon' | 'plain' } {
  if (!due) return { text: 'No date', tone: 'plain' }
  const t = new Date(due).getTime()
  const days = Math.floor((t - now) / DAY)
  if (t < now) {
    const late = Math.max(1, Math.ceil((now - t) / DAY))
    return { text: late === 1 ? '1 day late' : `${late} days late`, tone: 'late' }
  }
  if (days < 1) return { text: 'Due today', tone: 'soon' }
  if (days < 2) return { text: 'Due tomorrow', tone: 'soon' }
  const fmt = days < 7 ? { weekday: 'short' as const } : { month: 'short' as const, day: 'numeric' as const }
  return { text: `Due ${new Intl.DateTimeFormat('en-CA', fmt).format(new Date(due))}`, tone: 'plain' }
}

