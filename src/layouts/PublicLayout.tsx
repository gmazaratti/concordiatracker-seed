import { Link, Outlet } from 'react-router-dom'
import { useT } from '@/i18n/i18n'
import { PublicHeader } from '@/components/PublicHeader'

/** Chrome for the public marketing context. */
export function PublicLayout() {
  const t = useT()
  return (
    <div className="flex min-h-svh flex-col">
      <PublicHeader />

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-6 text-[12px] text-subtle sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <p>{t('landing.notAffiliated')}</p>
            <p>ConcordiaTracker: a student-built academic hub. Mock seed build.</p>
          </div>
          <nav className="flex flex-wrap gap-x-4 gap-y-1">
            {/* Plain anchors, not <Link>: these are build-time static pages
                outside the SPA, and client-side routing would send them to the
                profile route instead. */}
            <a href="/docs/introduction" className="transition-colors hover:text-fg">
              {t('landing.docs')}
            </a>
            <a href="/developers" className="transition-colors hover:text-fg">
              API
            </a>
            <a href="/about" className="transition-colors hover:text-fg">
              About
            </a>
            <a href="/contact" className="transition-colors hover:text-fg">
              Contact
            </a>
            <Link to="/privacy" className="transition-colors hover:text-fg">
              Privacy
            </Link>
            <Link to="/terms" className="transition-colors hover:text-fg">
              Terms
            </Link>
            <Link to="/organizer" className="transition-colors hover:text-fg">
              List your club
            </Link>
            <Link to="/educator" className="transition-colors hover:text-fg">
              Educators
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
