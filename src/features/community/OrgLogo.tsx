import type { EventOrg } from '@/data/community'
import { cn } from '@/lib/cn'

/** The org avatar tile — its real logo (object-cover) over a brand-colour block,
 * falling back to the coloured initials if the logo is absent or fails to load.
 * One place for the treatment shared by host rows, host cards, the profile
 * header, search results, and the following bar. */
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
  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden font-bold text-white',
        rounded,
        textClass,
        className,
      )}
      style={{ backgroundColor: org.color }}
      aria-hidden
    >
      {org.glyph}
      {org.logo && (
        <img
          src={org.logo}
          alt=""
          className="absolute inset-0 size-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
    </span>
  )
}
