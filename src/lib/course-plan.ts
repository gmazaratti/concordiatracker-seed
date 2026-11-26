import type { Prereq, Term } from './prereq'

/**
 * A course sequence: the semesters to come, and what goes in each.
 * (Asked for by a student: "a panel to plan semesters to come, with the option
 * of seeing what requisites are needed, plus work terms".)
 *
 * Pure: no React, no network. The page hands in the plan, what the student has
 * already done, and the calendar's prerequisite sentences already parsed; this
 * says, for every planned course, whether its prerequisites come before it.
 *
 * A plan is a sketch, not a registration. Nothing here is ever sent to
 * Concordia, and a warning is advice the student can ignore.
 */

export interface PlanCourse {
  /** As the calendar writes it: "COMM 225". */
  code: string
  title: string
  credits: number
}

export interface PlanTerm {
  /** "Winter 2027". */
  term: string
  /** A co-op work term (or any term away from classes). */
  work?: boolean
  courses: PlanCourse[]
}

export interface CoursePlan {
  terms: PlanTerm[]
}

export type PlanVerdict = 'ok' | 'missing' | 'unsure' | 'blocked' | 'repeat'

export interface PlanCheck {
  verdict: PlanVerdict
  /** One line for the row. Empty when there is nothing to say. */
  message: string
  /** Courses that would fix it if placed earlier, as display codes. */
  fixes: string[]
}

const SEASONS = ['Winter', 'Summer', 'Fall'] as const

/** "Fall 2026" -> "Winter 2027". Null when the name is not a term we know. */
export function nextTerm(term: string): string | null {
  const m = /^(Winter|Summer|Fall)\s+(\d{4})$/.exec(term.trim())
  if (!m) return null
  const i = SEASONS.indexOf(m[1] as (typeof SEASONS)[number])
  const year = Number(m[2])
  return i === 2 ? `Winter ${year + 1}` : `${SEASONS[i + 1]} ${year}`
}

/** `count` terms in a row, starting with the one after `after`. */
export function termsAfter(after: string, count: number): string[] {
  const out: string[] = []
  let t = nextTerm(after)
  while (t && out.length < count) {
    out.push(t)
    t = nextTerm(t)
  }
  return out
}

/** "COMM 225" / "comm225" -> "COMM225", the form prerequisites are keyed by. */
export function planKey(code: string): string {
  return code.replace(/[\s-]+/g, '').toUpperCase()
}

/** "COMM225" -> "COMM 225", for showing a code a prerequisite named. */
export function displayCode(key: string): string {
  const m = /^([A-Z]{3,4})(\d.*)$/.exec(key)
  return m ? `${m[1]} ${m[2]}` : key
}

export function termCredits(t: PlanTerm): number {
  return t.courses.reduce((n, c) => n + (c.credits || 0), 0)
}

export function planCredits(plan: CoursePlan): number {
  return plan.terms.reduce((n, t) => n + termCredits(t), 0)
}

/**
 * Drop terms that are no longer in the future, keeping everything planned in
 * the ones that still are. A plan made in the fall should not still be
 * offering that fall in January.
 */
export function rollForward(plan: CoursePlan, current: string, minTerms = 4): CoursePlan {
  const upcoming = termsAfter(current, 30)
  const kept = plan.terms.filter((t) => upcoming.includes(t.term))
  const byName = new Map(kept.map((t) => [t.term, t]))
  const lastWanted = kept.length ? Math.max(...kept.map((t) => upcoming.indexOf(t.term))) + 1 : 0
  const count = Math.max(minTerms, lastWanted)
  return { terms: upcoming.slice(0, count).map((name) => byName.get(name) ?? { term: name, courses: [] }) }
}

/** A term as a reader would say it: codes spaced, each alternative once. */
const names = (t: Term) => [...new Set(t.alternatives.map((a) => (a.code ? displayCode(a.code) : a.text)))].join(' or ')
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)

/**
 * Check every planned course against what comes before it.
 *
 * "Before" is: everything finished, everything being taken now (a plan assumes
 * you pass it), and everything planned in an earlier term. A course in the
 * SAME term only counts where the calendar says "previously or concurrently".
 *
 * Keys of the result are `${termIndex}:${planKey(code)}`.
 */
export function checkPlan(
  plan: CoursePlan,
  base: { completed: Set<string>; inProgress: Set<string>; credits: number; inProgressCredits?: number },
  prereqs: Map<string, Prereq>,
): Map<string, PlanCheck> {
  const out = new Map<string, PlanCheck>()
  const before = new Set<string>([...base.completed, ...base.inProgress])
  let credits = base.credits + (base.inProgressCredits ?? 0)
  /** Where each planned course sits, for "it is planned later". */
  const placed = new Map<string, number>()
  plan.terms.forEach((t, i) => t.courses.forEach((c) => {
    const k = planKey(c.code)
    if (!placed.has(k)) placed.set(k, i)
  }))

  plan.terms.forEach((t, i) => {
    const here = new Set(t.courses.map((c) => planKey(c.code)))
    for (const c of t.courses) {
      const key = planKey(c.code)
      const id = `${i}:${key}`
      if (base.completed.has(key) || base.inProgress.has(key)) {
        out.set(id, {
          verdict: 'repeat',
          message: base.completed.has(key) ? 'You already have this one.' : 'You are taking this one now.',
          fixes: [],
        })
        continue
      }
      if ((placed.get(key) ?? i) < i) {
        out.set(id, { verdict: 'repeat', message: `Already planned in ${plan.terms[placed.get(key)!].term}.`, fixes: [] })
        continue
      }
      const p = prereqs.get(key)
      if (!p) {
        out.set(id, { verdict: 'ok', message: '', fixes: [] })
        continue
      }
      const held = p.antirequisites.filter((a) => before.has(a))
      if (held.length > 0) {
        out.set(id, {
          verdict: 'blocked',
          message: `Not for credit with ${held.map(displayCode).join(', ')}, which comes before it.`,
          fixes: [],
        })
        continue
      }
      const missing: string[] = []
      const needs: string[] = []
      const fixes: string[] = []
      let unsure = ''
      for (const term of p.terms) {
        const codes = term.alternatives.map((a) => a.code).filter((x): x is string => x !== null)
        if (codes.some((x) => before.has(x))) continue
        if (term.concurrent && codes.some((x) => here.has(x))) continue
        if (term.alternatives.some((a) => a.code === null)) {
          unsure ||= `May need ${names(term)}.`
          continue
        }
        const same = codes.find((x) => here.has(x))
        const later = codes.find((x) => (placed.get(x) ?? -1) > i)
        if (same) missing.push(`${displayCode(same)} has to come before, not in the same term`)
        else if (later !== undefined) missing.push(`${displayCode(later)} is planned later, in ${plan.terms[placed.get(later)!].term}`)
        else if (!needs.includes(names(term))) needs.push(names(term))
        fixes.push(...codes.map(displayCode))
      }
      if (p.minCredits !== null && credits < p.minCredits) {
        missing.push(`needs ${p.minCredits} credits by then (the plan gets you to ${credits})`)
      }
      if (needs.length > 0) missing.unshift(`needs ${list(needs)} first`)
      if (missing.length > 0) {
        const text = missing.join('; ')
        out.set(id, { verdict: 'missing', message: text[0].toUpperCase() + text.slice(1) + '.', fixes: [...new Set(fixes)] })
      } else if (unsure || p.undecidable.length > 0) {
        out.set(id, { verdict: 'unsure', message: unsure || `Check: ${p.undecidable[0]}.`, fixes: [] })
      } else {
        out.set(id, { verdict: 'ok', message: '', fixes: [] })
      }
    }
    for (const k of here) before.add(k)
    credits += termCredits(t)
  })
  return out
}

/**
 * Spread a list of courses over the coming terms, in the order given.
 *
 * A course goes in the first term where everything it needs comes earlier (or
 * alongside, where the calendar allows that) and the term still has room. Work
 * terms are skipped. Courses already in the plan are left where they are.
 * Whatever cannot be placed is returned, not forced in.
 */
export function autoPlace(
  plan: CoursePlan,
  candidates: PlanCourse[],
  base: { completed: Set<string>; inProgress: Set<string>; credits: number; inProgressCredits?: number },
  prereqs: Map<string, Prereq>,
  maxCredits = 15,
): { placed: { index: number; course: PlanCourse }[]; left: PlanCourse[] } {
  const before = new Set<string>([...base.completed, ...base.inProgress])
  const planned = new Set(plan.terms.flatMap((t) => t.courses.map((c) => planKey(c.code))))
  let remaining = candidates.filter((c, i, all) => {
    const k = planKey(c.code)
    return !before.has(k) && !planned.has(k) && all.findIndex((x) => planKey(x.code) === k) === i
  })
  let total = base.credits + (base.inProgressCredits ?? 0)
  const placed: { index: number; course: PlanCourse }[] = []

  plan.terms.forEach((t, index) => {
    const here = new Set(t.courses.map((c) => planKey(c.code)))
    let credits = termCredits(t)
    const fits = (c: PlanCourse) => {
      if (credits + c.credits > maxCredits) return false
      const p = prereqs.get(planKey(c.code))
      if (!p) return true
      if (p.antirequisites.some((a) => before.has(a) || here.has(a))) return false
      if (p.minCredits !== null && total < p.minCredits) return false
      return p.terms.every((term) => {
        const codes = term.alternatives.map((a) => a.code).filter((x): x is string => x !== null)
        return (
          codes.some((x) => before.has(x)) ||
          (term.concurrent && codes.some((x) => here.has(x))) ||
          term.alternatives.some((a) => a.code === null)
        )
      })
    }
    if (!t.work) {
      // Again after each pass: something placed this term can satisfy a
      // "previously or concurrently" for the next one.
      for (let changed = true; changed; ) {
        changed = false
        for (const c of remaining) {
          if (!fits(c)) continue
          placed.push({ index, course: c })
          here.add(planKey(c.code))
          credits += c.credits
          remaining = remaining.filter((x) => x !== c)
          changed = true
          break
        }
      }
    }
    for (const k of here) before.add(k)
    total += credits
  })
  return { placed, left: remaining }
}

/**
 * What a course still needs that is not in `known`, as readable alternatives
 * ("COMM 217", "MECH 221 or MIAE 221"). Empty when nothing is missing or the
 * missing part is something we cannot check.
 */
export function missingPrereqs(code: string, prereqs: Map<string, Prereq>, known: Set<string>): string[] {
  const p = prereqs.get(planKey(code))
  if (!p) return []
  return p.terms
    .filter((t) => !t.alternatives.some((a) => a.code === null || known.has(a.code)))
    .map(names)
}
