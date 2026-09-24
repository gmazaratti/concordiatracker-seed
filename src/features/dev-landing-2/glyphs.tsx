/**
 * The handful of brand marks the Recordly comp needs, inline so the page pulls
 * in no assets or dependencies for them. lucide dropped its brand icons, which
 * is why these are hand-drawn.
 */
type P = { className?: string }

export function RecordlyMark({ className }: P) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="rec-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5aa2ff" />
          <stop offset="1" stopColor="#1f6bff" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#rec-g)" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#fff" strokeWidth="2.2" />
      <circle cx="16" cy="16" r="5.4" fill="#fff" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return (
          <circle key={i} cx={16 + Math.cos(a) * 11.6} cy={16 + Math.sin(a) * 11.6} r="0.9" fill="#fff" opacity="0.85" />
        )
      })}
    </svg>
  )
}

export function GitHubMark({ className }: P) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

export function WindowsMark({ className }: P) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="currentColor" aria-hidden>
      <path d="M1 3.2 8.2 2.2v7.1H1zM9.2 2.1 19 .8v8.5H9.2zM1 10.4h7.2v7.1L1 16.5zM9.2 10.4H19v8.6l-9.8-1.3z" />
    </svg>
  )
}

export function AppleMark({ className }: P) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="currentColor" aria-hidden>
      <path d="M13.9 10.6c0-2.2 1.8-3.2 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.6.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.5 0-2.8.9-3.6 2.2-1.5 2.7-.4 6.6 1.1 8.8.7 1.1 1.6 2.2 2.7 2.2 1.1 0 1.5-.7 2.8-.7 1.3 0 1.7.7 2.8.7 1.2 0 1.9-1.1 2.6-2.1.8-1.2 1.2-2.4 1.2-2.5-.1 0-2.3-.9-2.2-3.6zM11.8 4c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.6.6-1.1 1.6-.9 2.6 1 .1 1.9-.5 2.5-1.2z" />
    </svg>
  )
}

export function LinuxMark({ className }: P) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="currentColor" aria-hidden>
      <path d="M10 1c-2 0-3.2 1.7-3.2 3.8 0 1.4-.3 2.2-1.2 3.6C4.4 10.2 3 12.3 3 14.6c0 .6.1 1.1.3 1.6-.6.3-1.2.7-1.2 1.2 0 .8 1.6 1.2 3.4 1.4.9.1 1.4-.3 1.7-.6.9.3 1.8.4 2.8.4s1.9-.1 2.8-.4c.3.3.8.7 1.7.6 1.8-.2 3.4-.6 3.4-1.4 0-.5-.6-.9-1.2-1.2.2-.5.3-1 .3-1.6 0-2.3-1.4-4.4-2.6-6.2-.9-1.4-1.2-2.2-1.2-3.6C13.2 2.7 12 1 10 1z" />
    </svg>
  )
}

export function CodeRabbitMark({ className }: P) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="15" fill="currentColor" />
      <path
        d="M10.5 22.5c0-4.6 2.6-7.4 6.4-7.4 1 0 1.9.2 2.6.6l-1.2-5.2c-.2-.9.9-1.4 1.5-.7l3 3.8c.5.6.7 1.4.6 2.2l-.4 2.6c-.3 2.4-2.3 4.1-4.7 4.1h-7.8z"
        fill="#0b0b0b"
      />
    </svg>
  )
}
