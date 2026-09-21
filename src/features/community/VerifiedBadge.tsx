import { cn } from '@/lib/cn'

/** A crisp, FILLED verified badge — a scalloped seal in `info` blue with a white
 * check (Twitter-quality). Meaning: an authenticated real org (anti-impersonation),
 * distinct from any generic check. Decorative; the label conveys "Verified". */
export function VerifiedBadge({
  size = 15,
  className,
  tone = 'text-info',
  label = 'Verified org',
}: {
  size?: number
  className?: string
  /** Blue for an organisation, green for us, amber for someone who runs a
   *  club — see features/profile/badges.ts for why they differ. */
  tone?: string
  label?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      /* `align-[-0.18em]` because this sits inline beside a name and an SVG's
         box sits on the text baseline, which left the seal riding high next
         to the handle in the DM list and on profiles. `block` would fix the
         alignment and break the inline flow, so it is a nudge. */
      className={cn('inline-block shrink-0 align-[-0.18em]', tone, className)}
      role="img"
      aria-label={label}
    >
      <path
        fill="currentColor"
        d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
      />
      <path
        d="m8.5 12 2.5 2.5 4.5-5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
