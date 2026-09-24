/**
 * Line-style Google and Apple marks for the sign-in buttons, drawn the way a
 * Lucide icon is: 24px box, 2px stroke, round caps, `currentColor`. Lucide
 * removed its brand icons, so these are hand-drawn to sit beside the rest of
 * the app's line iconography instead of the filled four-colour logos.
 */
type P = { size?: number }

export function GoogleLineIcon({ size = 17 }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20.5 12.2c0 4.8-3.6 8.3-8.5 8.3a8.5 8.5 0 1 1 5.7-14.8" />
      <path d="M12.4 12.2h8.1" />
    </svg>
  )
}

export function AppleLineIcon({ size = 17 }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 7.5c-1.1-.9-2.4-1.3-3.6-1.2C5.9 6.5 4.5 8.6 4.5 11.4c0 3.5 2.2 7.6 4.2 8.9 1 .7 2 .7 3 .2.4-.2.8-.2 1.2 0 1 .5 2 .5 3-.2 1.4-.9 2.9-3.2 3.6-5.5-1.8-.7-2.9-2.3-2.9-4.2 0-1.5.8-2.9 2-3.7-.8-.9-2-1.5-3.3-1.5-1.2 0-2.3.5-3.3 1.1Z" />
      <path d="M12 7.5c0-2 1.3-3.6 3-4" />
    </svg>
  )
}
