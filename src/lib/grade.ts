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
