import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { LangSwitch } from '@/components/LangSwitch'
import { useDevCopy } from './copy'
import { HEADER_H } from './layout'

const link =
  'hidden rounded-md px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:text-fg'

/**
 * The draft's own header. It mirrors PublicLayout's structure (logo, links,
 * language, CTA) rather than reusing it, because PublicLayout is the live
 * site's chrome and this page must not change it.
 *
 * On a phone it is the mark, the language switch and one button: the full
 * wordmark plus both would not fit 375px.
 */
export function DevHeader() {
  const copy = useDevCopy()
  return (
    <header
      className="sticky top-0 z-40 border-b border-border/60 bg-canvas/80 backdrop-blur-md"
      style={{ height: HEADER_H }}
    >
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-5">
        <Link to="/dev/landing" aria-label="ConcordiaTracker home" className="shrink-0">
          <Logo className="hidden sm:flex" />
          <Logo showText={false} className="sm:hidden" />
        </Link>
        <nav className="flex min-w-0 items-center gap-1 sm:gap-2">
          <a href="#features" className={`${link} md:block`}>
            {copy.navFeatures}
          </a>
          <a href="/docs/introduction" className={`${link} md:block`}>
            {copy.navDocs}
          </a>
          <Link to="/organizer" className={`${link} lg:block`}>
            {copy.navClubs}
          </Link>
          <Link to="/teacher" className={`${link} lg:block`}>
            {copy.navTeachers}
          </Link>
          <LangSwitch className="mx-1" />
          <Link to="/dev/login" className={`${link} sm:block`}>
            {copy.signIn}
          </Link>
          <Link to="/app" className="shrink-0">
            <Button size="sm">{copy.openApp}</Button>
          </Link>
        </nav>
      </div>
    </header>
  )
}
