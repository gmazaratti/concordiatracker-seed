import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/cn'

/**
 * Back, meaning back — not "go to the page I would have come from".
 *
 * A `<Link to="/app/community">` PUSHES a new entry, so the feed it lands on
 * is a fresh page: top of the list, everything you had scrolled past to be
 * here gone. Popping the entry you actually came from is what restores your
 * place (see useScrollMemory), and it is also what the word on the button
 * means.
 *
 * `fallback` is for the entry point that had no history — a shared link
 * opened cold, where there is nothing behind this page. React Router keeps an
 * index on the history state; at 0 there is nowhere to go back to and the
 * button navigates to the fallback instead of doing nothing.
 */
export function BackButton({
  fallback,
  label = 'Back',
  showLabel = false,
  className,
}: {
  fallback: string
  label?: string
  showLabel?: boolean
  className?: string
}) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        const idx = (window.history.state as { idx?: number } | null)?.idx
        if (typeof idx === 'number' && idx > 0) navigate(-1)
        else navigate(fallback, { replace: true })
      }}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-lg text-[13px] font-medium text-muted transition-colors duration-150 hover:text-fg',
        className,
      )}
    >
      <ArrowLeft size={showLabel ? 15 : 19} aria-hidden />
      {showLabel && label}
    </button>
  )
}
