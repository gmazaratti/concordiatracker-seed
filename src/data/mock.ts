import type { User } from './types'

/**
 * THE single mock-data module (in-memory only — no backend, no persistence).
 * Currently seeds the signed-in user; courses/assignments/events are added as
 * their screens are built.
 *
 * NOTE: `plan` starts as 'free' so the free-vs-paid line and the contextual
 * paywall nudge are demonstrable. Revisit when Settings billing lands.
 */
export const currentUser: User = {
  name: 'Alex Degryse',
  email: 'alex.degryse@live.concordia.ca',
  initials: 'AD',
  plan: 'free',
}
