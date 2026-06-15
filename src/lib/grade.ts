import type { Grade } from '@/data/types'

/** Resolve any grade-entry form to a percentage (0–100), or null if the grade
 * is absent / incomplete. The single source of truth both screens read. */
export function gradeToPercent(grade: Grade | null): number | null {
  if (!grade) return null
  if (grade.mode === 'percent') return grade.percent
  if (grade.earned != null && grade.total != null && grade.total > 0) {
    return (grade.earned / grade.total) * 100
  }
  return null
}

/** Compact display of what the student entered: "12 / 15" or "88%". */
export function formatGrade(grade: Grade | null): string | null {
  const pct = gradeToPercent(grade)
  if (pct === null || !grade) return null
  if (grade.mode === 'raw') return `${grade.earned} / ${grade.total}`
  return `${Math.round(pct)}%`
}

/** Constructors used by the mock seed and (later) the Courses editor. */
export function rawGrade(earned: number, total: number): Grade {
  return { mode: 'raw', earned, total, percent: null }
}

export function percentGrade(percent: number): Grade {
  return { mode: 'percent', percent, earned: null, total: null }
}

/** Editable text for a grade — what the single smart field shows: "15 / 20" for a
 * raw score, "82" for a percent, "" when ungraded. */
export function gradeToInput(grade: Grade | null): string {
  if (!grade) return ''
  if (grade.mode === 'raw') {
    if (grade.earned == null && grade.total == null) return ''
    return `${grade.earned ?? ''} / ${grade.total ?? ''}`
  }
  return grade.percent == null ? '' : `${grade.percent}`
}

/** Parse what the student typed into the smart grade field. A slash means a raw
 * score ("15/20" → 75%); anything else is a percent ("82" or "82%"). Returns
 * null for empty (clears the grade) or unparseable input. */
export function parseGradeInput(text: string): Grade | null {
  const t = text.trim().replace(/%$/, '').trim()
  if (t === '') return null

  if (t.includes('/')) {
    const [rawEarned, rawTotal] = t.split('/').map((s) => s.trim())
    const earned = rawEarned === '' ? null : Number(rawEarned)
    const total = rawTotal === '' ? null : Number(rawTotal)
    if (earned !== null && !Number.isFinite(earned)) return null
    if (total !== null && !Number.isFinite(total)) return null
    if (earned === null && total === null) return null
    return { mode: 'raw', earned, total, percent: null }
  }

  const n = Number(t)
  return Number.isFinite(n) ? percentGrade(n) : null
}
