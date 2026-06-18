import type { OrgLinks } from '@/data/community'

export interface SocialField {
  key: keyof OrgLinks
  label: string
  placeholder: string
}

/** The org links shown on a profile + editable in the profile editor. One list
 * drives both the editor fields and the public icon buttons (icons live in
 * `SocialLinks.tsx`, keyed by `key`). */
export const SOCIAL_FIELDS: SocialField[] = [
  { key: 'website', label: 'Website / custom link', placeholder: 'https://linktr.ee/yourorg' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourorg' },
  { key: 'x', label: 'X (Twitter)', placeholder: 'https://x.com/yourorg' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/yourorg' },
]
