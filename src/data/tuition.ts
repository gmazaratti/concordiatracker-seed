/**
 * What a term actually costs, at Concordia's published 2026-2027 rates.
 *
 * CURATED, like the programme requirements, and for the same reason: these are
 * numbers a student may act on, so every one is transcribed by hand from a page
 * they can open themselves, stamped with the year it belongs to. Nothing here
 * is inferred, and when the rates change the fix is one edit in this file.
 *
 * Source, for every figure below:
 *   https://www.concordia.ca/students/financial/tuition-fees/rates/undergrad.html
 *   https://www.concordia.ca/students/financial/tuition-fees/university-fees.html
 */

export const TUITION_YEAR = '2026-2027'
export const TUITION_SOURCE =
  'https://www.concordia.ca/students/financial/tuition-fees/rates/undergrad.html'
export const FEES_SOURCE =
  'https://www.concordia.ca/students/financial/tuition-fees/university-fees.html'

export type TermKind = 'fall' | 'winter' | 'summer'

/**
 * Fee status decides the tuition rate, and it is the single biggest number on
 * the page — a Quebec resident and a new out-of-province student pay four times
 * apart for the same class.
 */
export interface FeeStatus {
  id: string
  label: string
  /** Per credit, tuition only (base + forfaitaire where one applies). */
  perCredit: number
  note?: string
}

export const FEE_STATUSES: FeeStatus[] = [
  { id: 'qc', label: 'Quebec resident', perCredit: 103.92 },
  {
    id: 'oop-grandfathered',
    label: 'Out-of-province — admitted before Fall 2024',
    perCredit: 324.35,
    note: 'Grandfathered rate.',
  },
  {
    id: 'oop-new',
    label: 'Out-of-province — admitted Fall 2024 or later',
    perCredit: 432.85,
  },
  {
    id: 'france-belgium',
    label: 'France or Belgium — grandfathered',
    perCredit: 324.35,
  },
  { id: 'intl-arts', label: 'International — Arts & Science', perCredit: 1160 },
  { id: 'intl-jmsb', label: 'International — John Molson', perCredit: 1400 },
  { id: 'intl-encs', label: 'International — Engineering & Computer Science', perCredit: 1285 },
  {
    id: 'intl-fine',
    label: 'International — Fine Arts, Independent or CUC',
    perCredit: 1010,
  },
]

/** The student association levied per credit, which differs by faculty. */
export interface Association {
  id: string
  label: string
  perCredit: number
}

export const ASSOCIATIONS: Association[] = [
  { id: 'asfa', label: 'Arts & Science (ASFA)', perCredit: 18.14 },
  { id: 'casa', label: 'John Molson (CASA)', perCredit: 24.04 },
  { id: 'eca', label: 'Engineering & Computer Science (ECA)', perCredit: 18.89 },
  { id: 'fasa', label: 'Fine Arts (FASA)', perCredit: 20.28 },
  { id: 'csu', label: 'Certificate or Independent (CSU)', perCredit: 14.56 },
]

/** Compulsory fees charged on every credit, whoever you are. */
export const PER_CREDIT_FEES: { label: string; amount: number; terms?: TermKind[] }[] = [
  { label: 'Administrative', amount: 13.38 },
  { label: 'Student services', amount: 12.07 },
  { label: 'Recreation & athletics', amount: 4.19, terms: ['fall'] },
  { label: 'Recreation & athletics', amount: 2.92, terms: ['winter', 'summer'] },
  { label: 'Technology infrastructure', amount: 6.31 },
  { label: 'Copyright', amount: 0.45 },
]

/** Charged once a term regardless of how many credits. */
export const PER_TERM_FEES: { label: string; amount: number; terms?: TermKind[] }[] = [
  { label: 'Registration', amount: 31.1 },
  { label: 'Legal essentials', amount: 10, terms: ['fall'] },
  { label: 'Legal essentials', amount: 20, terms: ['winter'] },
  { label: 'Telemedicine', amount: 4.99, terms: ['fall'] },
  { label: 'Telemedicine', amount: 9.96, terms: ['winter'] },
]

/**
 * The health and dental plan, billed in the fall for the whole year.
 *
 * Broken out from the rest because it is the one compulsory fee you can get
 * back — if you are already covered, opting out inside the window returns it,
 * and outside the window it does not. That is a dated, silent, irreversible
 * loss, which is exactly the kind of thing this product exists to catch.
 */
export const HEALTH_DENTAL = { label: 'Health & dental plan', amount: 225, optOut: true }

/** Charged to new students in their first term only. */
export const NEW_STUDENT_FEE = { fullTime: 40, partTime: 30 }
