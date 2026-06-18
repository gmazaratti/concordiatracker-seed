import { ExternalLink, Globe } from 'lucide-react'
import type { OrgLinks } from '@/data/community'
import { SOCIAL_FIELDS } from './social'

/** Bare host (no `www.`) for the "opens {site} in a new tab" warning. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'an external site'
  }
}

/* Brand glyphs as inline SVGs — lucide removed its brand icons (trademark). */

/** The modern X (Twitter) wordmark. */
function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  )
}

function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function LinkedinIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.8 0 0 .78 0 1.74v20.52C0 23.22.8 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.74V1.74C24 .78 23.2 0 22.22 0Z" />
    </svg>
  )
}

/** Render the right brand glyph for a link field. */
export function SocialFieldIcon({ field, size = 16 }: { field: keyof OrgLinks; size?: number }) {
  switch (field) {
    case 'instagram':
      return <InstagramIcon size={size} />
    case 'x':
      return <XIcon size={size} />
    case 'linkedin':
      return <LinkedinIcon size={size} />
    default:
      return <Globe size={size} aria-hidden />
  }
}

/** Icon-link buttons for an org's set links — rendered on the public profile.
 * Only links that exist render, so an org with one link shows one button. */
export function SocialLinks({ links, className }: { links?: OrgLinks; className?: string }) {
  if (!links) return null
  const items = SOCIAL_FIELDS.filter((f) => links[f.key]?.trim())
  if (items.length === 0) return null

  return (
    <div className={className}>
      {items.map((f) => {
        const href = links[f.key] as string
        return (
          <a
            key={f.key}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`${f.label} — opens in a new tab`}
            className="group relative grid size-9 place-items-center rounded-lg border border-border bg-surface text-muted transition-colors duration-150 hover:border-border-strong hover:text-fg"
          >
            <SocialFieldIcon field={f.key} size={16} />
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 hidden w-max max-w-[230px] rounded-lg border border-border bg-surface px-2.5 py-1.5 text-left shadow-xl group-hover:block group-focus-visible:block"
            >
              <span className="flex items-center gap-1 text-[12px] font-medium text-fg">
                {f.label}
                <ExternalLink size={11} aria-hidden />
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-subtle">
                External link — opens {hostOf(href)} in a new tab.
              </span>
            </span>
          </a>
        )
      })}
    </div>
  )
}
