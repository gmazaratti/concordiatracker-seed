import {
  ASSOCIATIONS,
  FEE_STATUSES,
  HEALTH_DENTAL,
  NEW_STUDENT_FEE,
  PER_CREDIT_FEES,
  PER_TERM_FEES,
  type TermKind,
} from '@/data/tuition'

/**
 * What a term costs, itemised.
 *
 * Pure, so the arithmetic can be checked in Node — which matters because the
 * output is a dollar figure somebody may budget against. Every line carries
 * how it was arrived at (rate × credits) rather than just a total, so a student
 * can reconcile this against their real invoice line by line instead of
 * wondering which of us is wrong.
 */

export interface CostLine {
  label: string
  /** Per-credit rate, when the line is charged that way. */
  rate?: number
  amount: number
  /** Rendered under the label — the working, not a footnote. */
  how: string
  group: 'tuition' | 'compulsory' | 'optional'
}

export interface CostEstimate {
  credits: number
  lines: CostLine[]
  tuition: number
  compulsory: number
  optional: number
  total: number
  /** What one more or one fewer credit changes, which is the number that
   *  actually answers "should I drop this". */
  perCredit: number
}

export interface CostInput {
  credits: number
  statusId: string
  associationId: string
  term: TermKind
  /** The health plan is billed in the fall and can be opted out of. */
  includeHealth: boolean
  newStudent: boolean
}

const money = (n: number) => Math.round(n * 100) / 100

/** Fees that apply in this term (some differ between fall and winter). */
const forTerm = <T extends { terms?: TermKind[] }>(rows: T[], term: TermKind) =>
  rows.filter((r) => !r.terms || r.terms.includes(term))

export function estimateTerm(input: CostInput): CostEstimate {
  const { credits, term } = input
  const status = FEE_STATUSES.find((s) => s.id === input.statusId) ?? FEE_STATUSES[0]
  const association = ASSOCIATIONS.find((a) => a.id === input.associationId) ?? ASSOCIATIONS[0]
  const lines: CostLine[] = []

  lines.push({
    label: `Tuition — ${status.label}`,
    rate: status.perCredit,
    amount: money(status.perCredit * credits),
    how: `$${status.perCredit.toFixed(2)} × ${credits} credits`,
    group: 'tuition',
  })

  for (const fee of forTerm(PER_CREDIT_FEES, term)) {
    lines.push({
      label: fee.label,
      rate: fee.amount,
      amount: money(fee.amount * credits),
      how: `$${fee.amount.toFixed(2)} × ${credits} credits`,
      group: 'compulsory',
    })
  }

  lines.push({
    label: `Student association — ${association.label}`,
    rate: association.perCredit,
    amount: money(association.perCredit * credits),
    how: `$${association.perCredit.toFixed(2)} × ${credits} credits`,
    group: 'compulsory',
  })

  for (const fee of forTerm(PER_TERM_FEES, term)) {
    lines.push({
      label: fee.label,
      amount: fee.amount,
      how: 'Flat, once this term',
      group: 'compulsory',
    })
  }

  if (input.newStudent) {
    const amount = credits >= 12 ? NEW_STUDENT_FEE.fullTime : NEW_STUDENT_FEE.partTime
    lines.push({
      label: 'New student program',
      amount,
      how: `First term only, ${credits >= 12 ? 'full' : 'part'}-time rate`,
      group: 'compulsory',
    })
  }

  // Fall only: the plan covers the year and is billed once, in September.
  if (input.includeHealth && term === 'fall') {
    lines.push({
      label: HEALTH_DENTAL.label,
      amount: HEALTH_DENTAL.amount,
      how: 'Billed once in the fall, covers the whole year',
      group: 'optional',
    })
  }

  const sum = (group: CostLine['group']) =>
    money(lines.filter((l) => l.group === group).reduce((s, l) => s + l.amount, 0))

  const tuition = sum('tuition')
  const compulsory = sum('compulsory')
  const optional = sum('optional')

  // Everything charged per credit, added up once. This is the marginal cost of
  // a course, and it is the only figure that answers "what does dropping save".
  const perCredit = money(
    status.perCredit +
      association.perCredit +
      forTerm(PER_CREDIT_FEES, term).reduce((s, f) => s + f.amount, 0),
  )

  return {
    credits,
    lines,
    tuition,
    compulsory,
    optional,
    total: money(tuition + compulsory + optional),
    perCredit,
  }
}

/** What dropping a course of this size takes off the bill. */
export function refundIfDropped(estimate: CostEstimate, credits: number): number {
  return Math.round(estimate.perCredit * credits * 100) / 100
}
