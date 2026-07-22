import { useState } from 'react'
import type { EventOrg } from '@/data/community'
import { cn } from '@/lib/cn'

/** The org avatar tile — its real logo (object-cover) on a NEUTRAL backdrop,
 * falling back to the brand-colour block + initials only when there's no logo (or
 * it fails to load). Neutral (not the brand colour) behind a logo so a
 * transparent PNG doesn't get a coloured halo / show the fallback letters through
 * it. One place for the treatment shared by host rows, cards, the profile header,
 * search results, and the switcher. */
export function OrgLogo({
  org,
  className,
  rounded = 'rounded-md',
  textClass = 'text-[11px]',
}: {
  org: EventOrg
  /** Size utilities, e.g. `size-7`. */
  className?: string
  /** Corner rounding utility. */
  rounded?: string
  /** Initials text-size utility. */
  textClass?: string
}) {
  const [failed, setFailed] = useState(false)
  const showLogo = !!org.logo && !failed

  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden font-bold text-white',
        rounded,
        textClass,
        className,
      )}
      style={{ backgroundColor: showLogo ? 'var(--ct-surface-2)' : org.color }}
      aria-hidden
    >
      {showLogo ? (
        <img
          src={org.logo}
          alt=""
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        org.glyph
      )}
    </span>
  )
}
