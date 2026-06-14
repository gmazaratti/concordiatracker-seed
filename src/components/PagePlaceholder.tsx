/**
 * Temporary stub for screens not yet built. Replaced screen-by-screen as the
 * build progresses; keeps routing real and avoids duplicated page chrome.
 */
export function PagePlaceholder({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string
  title: string
  description: string
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center gap-3 px-6 text-center">
      {eyebrow && (
        <p className="text-[11px] font-medium tracking-[0.2em] text-subtle uppercase">
          {eyebrow}
        </p>
      )}
      <h1 className="font-display text-3xl font-medium text-fg">{title}</h1>
      <p className="max-w-md text-sm text-muted">{description}</p>
      <span className="mt-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] text-subtle">
        Coming in a later build step
      </span>
    </div>
  )
}
