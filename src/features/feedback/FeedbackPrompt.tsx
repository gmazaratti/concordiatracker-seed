import { Link } from 'react-router-dom'
import { Bug, Lightbulb } from 'lucide-react'

/** Calm, low-emphasis discovery entry for Today's bottom — deliberately quiet so
 * it never competes with the due list or the glance rail. */
export function FeedbackPrompt() {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-t border-border/60 pt-5 text-[12px] text-subtle">
      <span>Got an idea?</span>
      <Link
        to="/feedback?tab=requests"
        className="inline-flex items-center gap-1 font-medium text-muted transition-colors duration-150 hover:text-accent"
      >
        <Lightbulb size={13} aria-hidden /> Request a feature
      </Link>
      <span aria-hidden className="text-border-strong">·</span>
      <Link
        to="/feedback?tab=bugs"
        className="inline-flex items-center gap-1 font-medium text-muted transition-colors duration-150 hover:text-accent"
      >
        <Bug size={13} aria-hidden /> Report a bug
      </Link>
    </div>
  )
}
