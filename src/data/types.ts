/**
 * Domain types for the single in-memory mock-data module.
 * Grows as screens land (courses, assignments, events, provenance…).
 */

export type Plan = 'free' | 'semester'

export interface User {
  name: string
  email: string
  initials: string
  plan: Plan
}
