import { Link, Outlet } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { useT } from '@/i18n/i18n'
import { LangToggle } from '@/components/LangToggle'

/** Chrome for the public marketing context. */
export function PublicLayout() {
  const t = useT()
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-canvas/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/" aria-label="ConcordiaTracker home">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <a
              href="#how"
              className="hidden rounded-md px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:text-fg sm:block"
            >
              {t('landing.howItWorks')}
            </a>
            <a
              href="#pricing"
              className="hidden rounded-md px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:text-fg sm:block"
            >
              {t('landing.pricing')}
            </a>
            <a
              href="/docs/introduction"
              className="hidden rounded-md px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:text-fg sm:block"
            >
              {t('landing.docs')}
            </a>
            <Link to="/teacher" className="hidden sm:block">
              <Button variant="ghost" size="sm">
                {t('landing.forTeachers')}
              </Button>
            </Link>
            {/* Kept before the CTA so French is visible without scrolling or
                hunting — availability is the point, not decoration. */}
            <LangToggle className="mr-1" />
            <Link to="/app">
              <Button size="sm">{t('landing.ctaPrimary')}</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-6 text-[12px] text-subtle sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <p>{t('landing.notAffiliated')}</p>
            <p>ConcordiaTracker — a student-built academic hub. Mock seed build.</p>
          </div>
          <nav className="flex flex-wrap gap-x-4 gap-y-1">
            <a href="/docs/introduction" className="transition-colors hover:text-fg">
              {t('landing.docs')}
            </a>
            <Link to="/privacy" className="transition-colors hover:text-fg">
              Privacy
            </Link>
            <Link to="/terms" className="transition-colors hover:text-fg">
              Terms
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
