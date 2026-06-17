import { daysFromNow } from '@/lib/date'

/**
 * Runtime peer-correction stub — the "Waze for academics" model. When classmates
 * in your section change an imported date, the crowd's correction is SUGGESTED to
 * you (never applied automatically). The seed only mocks the interaction: real
 * convergence needs many real users + a backend, so it's a connection-phase
 * feature. Honesty matters — we show the raw count ("N of M classmates"), never a
 * fabricated "consensus", so a 1-person change reads as weak and a clear majority
 * reads as strong.
 */
export interface PeerCorrection {
  /** The imported assessment this correction targets. */
  assessmentId: string
  /** The date the crowd moved it to (ISO). */
  proposedDue: string
  /** How many classmates in your section made this change (the signal). */
  changedCount: number
  /** How many classmates are in the section (the honest denominator). */
  sectionSize: number
}

/** Seeded so the flow is demonstrable on load — a strong, a medium, and a weak
 * (one-person) signal, on three upcoming imported assignments. */
export const seedPeerCorrections: PeerCorrection[] = [
  // Strong — a clear majority moved it.
  { assessmentId: 'comp248-a2', proposedDue: daysFromNow(5), changedCount: 5, sectionSize: 6 },
  // Medium — a meaningful chunk, not a majority.
  { assessmentId: 'poli202-q1', proposedDue: daysFromNow(9), changedCount: 3, sectionSize: 8 },
  // Weak — a single classmate; deliberately reads as thin.
  { assessmentId: 'engl233-e1', proposedDue: daysFromNow(7), changedCount: 1, sectionSize: 5 },
]

export type SignalStrength = 'strong' | 'medium' | 'weak'

/** Strength from the raw fraction — a single voice is always weak no matter the
 * section size; a clear majority is strong. */
export function correctionStrength(c: PeerCorrection): SignalStrength {
  if (c.changedCount <= 1) return 'weak'
  const ratio = c.changedCount / c.sectionSize
  if (ratio >= 0.6) return 'strong'
  if (ratio >= 0.34) return 'medium'
  return 'weak'
}
