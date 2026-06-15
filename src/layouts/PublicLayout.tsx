import { Link, Outlet } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'

/** Chrome for the public marketing context. */
export function PublicLayout() {
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
              How it works
            </a>
            <a
              href="#pricing"
              className="hidden rounded-md px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:text-fg sm:block"
            >
              Pricing
            </a>
            <Link to="/teacher" className="hidden sm:block">
              <Button variant="ghost" size="sm">
                For teachers
              </Button>
            </Link>
            <Link to="/app">
              <Button size="sm">Open app</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-5 py-6 text-[12px] text-subtle">
          <p>Not affiliated with Concordia University.</p>
          <p>ConcordiaTracker — a student-built academic hub. Mock seed build.</p>
        </div>
      </footer>
    </div>
  )
}
