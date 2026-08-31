import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

/**
 * The shell the Community sub-pages share.
 *
 * Both of them are lists reached from the feed, so both need the same three
 * things: a way back that does not depend on the browser button, a title, and a
 * reading-width column. Written once so the two cannot drift.
 */
export function CommunitySubPage({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-5 sm:px-6">
      <Link
        to="/app/community"
        className="inline-flex items-center gap-1.5 text-[13px] text-subtle transition-colors duration-150 hover:text-fg"
      >
        <ArrowLeft size={15} aria-hidden />
        Community
      </Link>
      <header className="mt-3 mb-4">
        <h1 className="font-display text-[24px] leading-tight font-medium text-fg">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-subtle">{subtitle}</p>}
      </header>
      {children}
    </div>
  )
}
