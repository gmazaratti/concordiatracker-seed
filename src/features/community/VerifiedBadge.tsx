import { cn } from '@/lib/cn'

/** A crisp, FILLED verified badge — a scalloped seal in `info` blue with a white
 * check (Twitter-quality). Meaning: an authenticated real org (anti-impersonation),
 * distinct from any generic check. Decorative; the label conveys "Verified". */
export function VerifiedBadge({ size = 15, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn('shrink-0 text-info', className)}
      role="img"
      aria-label="Verified org"
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
