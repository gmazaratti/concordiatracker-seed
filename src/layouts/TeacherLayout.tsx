import { Link, Outlet, useLocation } from 'react-router-dom'
import { GraduationCap, LogOut, ShieldCheck } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { cn } from '@/lib/cn'

/**
 * Distinct chrome for the Teacher portal — a plain top-bar "dashboard" (no
 * student sidebar or command palette), so it reads as a separate context for a
 * different audience.
 */
export function TeacherLayout() {
  const { currentTeacher, signOut } = useTeacher()
  const { pathname } = useLocation()
  const onAdmin = pathname.startsWith('/teacher/admin')

  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <header className="border-b border-border bg-surface/40">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-3">
          <Link to="/teacher" className="flex items-center gap-2 text-[14px] font-medium text-fg">
            <GraduationCap size={18} className="text-accent" aria-hidden />
            ConcordiaTracker
            <span className="hidden text-subtle sm:inline">· Teacher portal</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to="/teacher/admin"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-150',
                onAdmin ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              <ShieldCheck size={14} aria-hidden />
              Admin
            </Link>

            {currentTeacher ? (
              <>
                <span className="hidden items-center gap-2 border-l border-border pl-3 sm:flex">
                  <span className="text-[13px] font-medium text-fg">{currentTeacher.name}</span>
                  <StatusChip status={currentTeacher.status} />
                </span>
                <button
                  type="button"
                  onClick={signOut}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
                >
                  <LogOut size={14} aria-hidden />
                  Sign out
                </button>
              </>
            ) : (
              <Link
                to="/"
                className="rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
              >
                Exit
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}

export function StatusChip({ status }: { status: 'pending' | 'approved' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        status === 'approved' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning',
      )}
    >
      {status === 'approved' ? 'Approved' : 'Pending approval'}
    </span>
  )
}
