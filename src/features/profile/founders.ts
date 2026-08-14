import type { OrgLinks } from '@/data/community'

/**
 * People who get the founder treatment on their public profile: a verified seal,
 * a role tag, links, and the animated header.
 *
 * Keyed by handle and kept tiny on purpose — this is a real, closed set, not a
 * feature users can grant themselves. (Cosmetic only; every actual permission is
 * gated by `is_admin()` at the database.)
 */
export interface FounderProfile {
  /** Shown next to the verified seal. */
  role: string
  /** One line under the name, in their voice. */
  tagline?: string
  links?: OrgLinks
}

export const FOUNDERS: Record<string, FounderProfile> = {
  alex: {
    role: 'Founder',
    tagline: 'Building ConcordiaTracker so nobody else has to guess what’s due.',
    links: {
      website: 'https://alexdegryse.com',
      linkedin: 'https://linkedin.com/in/alexdegryse',
    },
  },
}

export function founderFor(handle: string): FounderProfile | undefined {
  return FOUNDERS[handle.toLowerCase()]
}
