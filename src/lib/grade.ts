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

/**
 * What the smart grade field holds: nothing (which clears the grade), a grade,
 * or something that is NOT a grade — with the sentence that says why.
 *
 * "Empty" and "unreadable" used to be the same `null`, so typing "abc" was
 * saved as clearing the grade: a real 82% disappeared with no error, and the
 * letters stayed in the field. They are different answers and every caller
 * has to be able to tell them apart.
 */
export type GradeInput =
  | { kind: 'empty' }
  | { kind: 'grade'; grade: Grade }
  | { kind: 'invalid'; error: string }

const NUMBER = /^\d+(\.\d+)?$|^\.\d+$/

/** Read what the student typed. A slash means a raw score ("15/20" → 75%);
 * anything else is a percent ("82" or "82%"). Percentages run 0 to 100 and a
 * score cannot exceed its total — a grade outside that range is a typo, and
 * saving it would put a 150% or a negative mark into someone's GPA. */
export function readGradeInput(text: string): GradeInput {
  const t = text.trim().replace(/%$/, '').trim()
  if (t === '') return { kind: 'empty' }

  if (t.includes('/')) {
    const parts = t.split('/').map((s) => s.trim())
    if (parts.length !== 2) return { kind: 'invalid', error: 'Write a score as one number over another, like 15/20.' }
    const [a, b] = parts
    if (a === '' || b === '') return { kind: 'invalid', error: 'A score needs both numbers, like 15/20.' }
    if (!NUMBER.test(a) || !NUMBER.test(b)) {
      return { kind: 'invalid', error: 'A score is two numbers, like 15/20.' }
    }
    const earned = Number(a)
    const total = Number(b)
    if (total <= 0) return { kind: 'invalid', error: 'The total has to be more than 0.' }
    if (earned > total) return { kind: 'invalid', error: `${a}/${b} is more than full marks.` }
    return { kind: 'grade', grade: rawGrade(earned, total) }
  }

  if (/^-/.test(t)) return { kind: 'invalid', error: 'A grade can’t be below 0%.' }
  if (!NUMBER.test(t)) {
    return { kind: 'invalid', error: 'Enter a percent like 82, or a score like 15/20.' }
  }
  const n = Number(t)
  if (n > 100) return { kind: 'invalid', error: 'A percentage goes up to 100.' }
  return { kind: 'grade', grade: percentGrade(n) }
}

/** The grade the field resolves to, or null when it is empty OR invalid. Only
 * for DISPLAY (the live "82% · A-" preview) — anything that saves must use
 * `readGradeInput` and refuse the invalid case. */
export function parseGradeInput(text: string): Grade | null {
  const r = readGradeInput(text)
  return r.kind === 'grade' ? r.grade : null
}
