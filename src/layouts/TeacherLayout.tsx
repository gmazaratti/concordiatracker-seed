import { Link, Outlet } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/**
 * Deliberately plain chrome for the Teacher portal — a visibly distinct
 * context from the student app (no sidebar, no command palette).
 */
export function TeacherLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-border bg-surface/40">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-4">
          <span className="flex items-center gap-2 text-sm font-medium text-fg">
            <GraduationCap size={18} className="text-accent" aria-hidden />
            ConcordiaTracker
            <span className="text-subtle">· Teacher portal</span>
          </span>
          <Link to="/">
            <Button variant="ghost" size="sm">
              Exit
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
