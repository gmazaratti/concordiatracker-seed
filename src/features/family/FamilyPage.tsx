import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarClock, Eye, GraduationCap, Loader2, LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/app/providers/auth'
import { LoginScreen } from '@/features/auth/LoginScreen'
import { Logo } from '@/components/Logo'
import { rememberReturn } from '@/lib/auth-intent'
import {
  acceptGuardianInvite,
  guardianInviteInfo,
  guardianView,
  myGuardedStudents,
  type GuardedStudent,
  type GuardianView,
  type InviteInfo,
} from '@/lib/guardians'
import { courseColor } from '@/lib/course-color'
import { percentToGrade } from '@/lib/gpa'
import { cn } from '@/lib/cn'

/**
 * Family access, the parent's side. Read-only by construction: everything on
 * this page comes from one function (guardian_view) that only answers through
 * an active link the student made, and nothing here writes the student's data.
 */
function Shell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth()
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <Link to="/family" className="flex items-center gap-2">
          <Logo />
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">Family</span>
        </Link>
        {user && (
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-muted hover:text-fg"
          >
            <LogOut size={14} aria-hidden /> Sign out
          </button>
        )}
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 py-6">{children}</main>
    </div>
  )
}

export function FamilyJoinPage() {
  const { token = '' } = useParams()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [info, setInfo] = useState<InviteInfo | null | undefined>(undefined)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void guardianInviteInfo(token).then(setInfo)
  }, [token, user])

  if (loading) return null
  if (!user) {
    rememberReturn(`/family/join/${token}`)
    return <LoginScreen />
  }

  async function accept() {
    setBusy(true)
    setError('')
    try {
      const student = await acceptGuardianInvite(token)
      navigate(`/family?student=${student}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.')
      setBusy(false)
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-6 text-center">
        <ShieldCheck size={28} className="mx-auto text-accent" aria-hidden />
        {info === undefined ? (
          <Loader2 size={18} className="mx-auto mt-4 animate-spin text-subtle" aria-hidden />
        ) : !info ? (
          <p className="mt-3 text-[14px] text-fg">That invite link is not valid.</p>
        ) : info.mine ? (
          <p className="mt-3 text-[14px] text-fg">This is your own invite. Send the link to your parent or guardian.</p>
        ) : (
          <>
            <h1 className="mt-3 text-[19px] font-semibold text-fg">{info.student_name} invited you</h1>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
              You will be able to see their courses and deadlines on ConcordiaTracker. You cannot change anything, and they
              decide what is shared and can end it at any time.
            </p>
            {info.status === 'revoked' ? (
              <p className="mt-4 text-[13px] text-danger">That invite was cancelled.</p>
            ) : info.expired && info.status === 'pending' ? (
              <p className="mt-4 text-[13px] text-danger">That invite has expired. Ask for a new one.</p>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void accept()}
                className="mt-5 w-full rounded-xl bg-accent py-2.5 text-[14px] font-semibold text-accent-contrast disabled:opacity-50"
              >
                {busy ? 'Joining' : 'Accept and view'}
              </button>
            )}
            {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}
          </>
        )}
      </div>
    </Shell>
  )
}

export function FamilyPage() {
  const { user, loading } = useAuth()
  const [students, setStudents] = useState<GuardedStudent[] | null>(null)
  const params = new URLSearchParams(window.location.search)
  const [picked, setPicked] = useState<string | null>(params.get('student'))

  useEffect(() => {
    if (!user) return
    void myGuardedStudents().then((s) => {
      setStudents(s)
      setPicked((p) => p ?? s[0]?.student ?? null)
    })
  }, [user])

  if (loading) return null
  if (!user) {
    rememberReturn('/family')
    return <LoginScreen />
  }

  return (
    <Shell>
      {students === null ? (
        <Loader2 size={18} className="mx-auto animate-spin text-subtle" aria-hidden />
      ) : students.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-[15px] font-medium text-fg">No one has shared with you yet</p>
          <p className="mt-1.5 text-[13px] text-subtle">
            A student creates an invite in Settings, Family, and sends you the link.
          </p>
        </div>
      ) : (
        <>
          {students.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {students.map((s) => (
                <button
                  key={s.student}
                  type="button"
                  onClick={() => setPicked(s.student)}
                  className={cn(
                    'rounded-full px-3 py-1 text-[12.5px] font-medium',
                    picked === s.student ? 'bg-accent text-accent-contrast' : 'border border-border text-muted',
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
          {picked && <StudentView key={picked} student={picked} />}
        </>
      )}
    </Shell>
  )
}

function StudentView({ student }: { student: string }) {
  const [view, setView] = useState<GuardianView | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    void guardianView(student)
      .then(setView)
      .catch((e: Error) => setError(e.message))
  }, [student])

  const now = new Date().toISOString()
  const current = useMemo(() => (view?.courses ?? []).filter((c) => !c.archived), [view])
  const upcoming = useMemo(
    () =>
      (view?.assessments ?? []).filter(
        (a) => a.due && a.due >= now && !['done', 'late', 'awaiting-grade', 'excused', 'missed'].includes(a.status ?? ''),
      ),
    [view, now],
  )
  const overdue = useMemo(
    () => (view?.assessments ?? []).filter((a) => a.due && a.due < now && ['not-started', 'in-progress', 'extension', null].includes(a.status)),
    [view, now],
  )
  if (error) return <p className="text-[13px] text-danger">{error}</p>
  if (!view) return <Loader2 size={18} className="mx-auto animate-spin text-subtle" aria-hidden />
  const course = (id: string) => current.find((c) => c.id === id)
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
  const scoreOf = (a: GuardianView['assessments'][number]) =>
    a.score != null ? a.score : a.raw_score != null && a.raw_total ? (a.raw_score / a.raw_total) * 100 : null

  return (
    <div>
      <h1 className="text-[22px] font-semibold text-fg">{view.name}</h1>
      <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-subtle">
        <Eye size={13} aria-hidden /> View only. {view.grades ? 'Grades are shared.' : 'Grades are not shared.'}
      </p>

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-subtle uppercase">
          <CalendarClock size={14} aria-hidden /> Coming up
        </h2>
        {overdue.length > 0 && (
          <p className="mt-2 text-[12.5px] text-warning">
            {overdue.length} past due and not marked done (they may simply not have ticked it off).
          </p>
        )}
        {upcoming.length === 0 ? (
          <p className="mt-2 text-[13px] text-subtle">Nothing due.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface">
            {upcoming.slice(0, 15).map((a) => {
              const c = course(a.course)
              return (
                <li key={a.id} className="flex items-center gap-3 px-3.5 py-2.5">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: courseColor(c?.color ?? 'blue').hex }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] text-fg">{a.title}</span>
                    <span className="block text-[11.5px] text-subtle">
                      {c?.code ?? 'Course'} · {a.weight}% of the grade
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] text-muted">{fmt(a.due!)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="mt-7">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-subtle uppercase">
          <GraduationCap size={14} aria-hidden /> Courses this term
        </h2>
        <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
          {current.map((c) => {
            const items = view.assessments.filter((a) => a.course === c.id)
            return (
              <article key={c.id} className="rounded-xl border border-border bg-surface p-3.5">
                <p className="text-[13.5px] font-semibold text-fg">
                  <span className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ backgroundColor: courseColor(c.color ?? 'blue').hex }} aria-hidden />
                  {c.code}
                </p>
                <p className="truncate text-[12px] text-subtle">{c.name}</p>
                {(c.time || c.location) && <p className="mt-1 text-[11.5px] text-subtle">{[c.time, c.location].filter(Boolean).join(' · ')}</p>}
                <ul className="mt-2 space-y-1">
                  {items.map((a) => {
                    const s = view.grades ? scoreOf(a) : null
                    return (
                      <li key={a.id} className="flex items-baseline gap-2 text-[12px]">
                        <span className="min-w-0 flex-1 truncate text-muted">{a.title}</span>
                        <span className="shrink-0 text-subtle">{a.weight}%</span>
                        {s != null && (
                          <span className="shrink-0 font-medium text-fg">
                            {Math.round(s)}% {percentToGrade(s).letter}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </article>
            )
          })}
        </div>
      </section>

      {view.schedule && view.schedules.length > 0 && (
        <section className="mt-7">
          <h2 className="text-[13px] font-semibold tracking-wide text-subtle uppercase">Saved schedules</h2>
          <ul className="mt-2 space-y-1.5">
            {view.schedules.map((s, i) => (
              <li key={i} className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-fg">
                {s.name}
                <span className="ml-2 text-[12px] text-subtle">
                  {Array.isArray(s.sections) ? `${s.sections.length} classes` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
