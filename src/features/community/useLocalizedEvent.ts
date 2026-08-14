import { useI18n } from '@/i18n/i18n'
import { localized } from '@/lib/localized'
import type { CampusEvent, EventOrg } from '@/data/community'

/**
 * Event copy in the reader's language, falling back to the published default.
 *
 * A hook rather than a plain call so every surface — feed tile, detail, public
 * page — resolves identically and none of them can forget the fallback.
 */
export function useLocalizedEvent(event: CampusEvent): {
  title: string
  description: string
  location: string
} {
  const { lang } = useI18n()
  return {
    title: localized(event, lang, 'title'),
    description: localized(event, lang, 'description'),
    location: localized(event, lang, 'location'),
  }
}

/** An organization's bio in the reader's language. */
export function useLocalizedOrgBio(org: EventOrg): string {
  const { lang } = useI18n()
  return localized(org, lang, 'bio')
}
