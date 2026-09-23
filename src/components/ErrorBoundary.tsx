import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * The thing that stops one bad row taking the whole app with it.
 *
 * WHY THIS EXISTS. React unmounts the ENTIRE tree when a render throws and
 * nothing catches it — so a single message whose attachment is missing a field
 * left a grey screen with no nav, no back button and no way out but restarting
 * the app. That is the worst failure this product can produce: it is total, it
 * is silent, and it looks like the whole thing is broken rather than one card.
 *
 * TWO SIZES, ON PURPOSE.
 *  - `variant="inline"` wraps ONE item (a message, an attachment card). The
 *    rest of the conversation keeps working and the failure is the size of the
 *    thing that failed.
 *  - `variant="page"` wraps a screen, as the last line of defence. It still
 *    leaves the shell — sidebar, tabs, everything else — alive.
 *
 * IT SHOWS THE ERROR. Swallowing it produces a second mystery on top of the
 * first: somebody reports "it went blank" and there is nothing to go on. The
 * text is behind a disclosure so it is never in the way, and it is the exact
 * message a bug report needs.
 *
 * RESETS ON `resetKey`. Without it, opening a different conversation after one
 * bad message keeps showing the error — the boundary has no idea the thing it
 * failed on is gone.
 */
export class ErrorBoundary extends Component<
  {
    children: ReactNode
    /** Changing this clears a caught error — pass the id of whatever is inside. */
    resetKey?: string | number
    variant?: 'inline' | 'page'
    /** Shown instead of the default sentence. */
    label?: string
    className?: string
  },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidUpdate(prev: { resetKey?: string | number }) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept out of the UI but in the console, where a developer looking at a
    // report can see which component stack produced it.
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const { variant = 'inline', label, className } = this.props
    const detail = `${error.name}: ${error.message}`

    if (variant === 'page') {
      return (
        <div className={cn('grid min-h-[60vh] place-items-center px-6', className)}>
          <div className="w-full max-w-sm text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-warning/10 text-warning">
              <AlertTriangle size={22} aria-hidden />
            </span>
            <h2 className="mt-3 text-[16px] font-semibold text-fg">
              {label ?? 'This screen ran into a problem'}
            </h2>
            <p className="mt-1 text-[13.5px] text-subtle">
              The rest of the app is still working — you can go somewhere else, or try this
              again.
            </p>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
            >
              <RotateCcw size={14} aria-hidden />
              Try again
            </button>
            <Detail detail={detail} />
          </div>
        </div>
      )
    }

    return (
      <div
        className={cn(
          'my-1 rounded-xl border border-dashed border-border bg-surface-2/50 px-3 py-2.5',
          className,
        )}
      >
        <p className="flex items-center gap-1.5 text-[12.5px] text-subtle">
          <AlertTriangle size={13} className="shrink-0 text-warning" aria-hidden />
          {label ?? "This couldn't be displayed"}
        </p>
        <Detail detail={detail} />
      </div>
    )
  }
}

function Detail({ detail }: { detail: string }) {
  return (
    <details className="mt-1.5 text-left">
      <summary className="cursor-pointer list-none text-[11.5px] text-subtle underline-offset-2 hover:underline">
        Details
      </summary>
      <p className="mt-1 font-mono text-[11px] leading-snug break-words text-muted">{detail}</p>
    </details>
  )
}
