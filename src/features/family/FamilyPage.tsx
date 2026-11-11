import { useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { Loader2, LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/app/providers/auth'
import { LoginScreen } from '@/features/auth/LoginScreen'
import { Logo } from '@/components/Logo'
import { rememberReturn } from '@/lib/auth-intent'
import { acceptGuardianInvite, guardianInviteInfo, type InviteInfo } from '@/lib/guardians'
import { FamilyShell } from './FamilyShell'
import { FamilyToday } from './FamilyToday'
import { FamilyCourse, FamilyCourses } from './FamilyCourses'
import { FamilyCalendar } from './FamilyCalendar'
import { useFamilyData, useGuarded } from './family-data'

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
          <span className="flex items-center gap-1">
          <Link to="/app" className="rounded-lg px-2.5 py-1.5 text-[12.5px] text-muted hover:text-fg">
            My app
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-muted hover:text-fg"
          >
            <LogOut size={14} aria-hidden /> Sign out
          </button>
          </span>
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

  useEffect(() => {
    if (!loading && !user) rememberReturn(`/family/join/${token}`)
  }, [loading, user, token])

  if (loading) return null
  if (!user) return <LoginScreen />

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
  const { students, current, pick } = useGuarded()
  const { data, error } = useFamilyData(user ? (current?.student ?? null) : null)

  // Remember where to come back to only when DEFINITELY signed out, and in an
  // effect, never during render: a render that briefly saw no user used to
  // re-save "/family" and bounce every later visit to /app back here.
  useEffect(() => {
    if (!loading && !user) rememberReturn('/family')
  }, [loading, user])

  if (loading) return null
  if (!user) return <LoginScreen />
  if (students === null) return <Centre><Loader2 size={18} className="animate-spin text-subtle" aria-hidden /></Centre>
  if (students.length === 0) {
    return (
      <Shell>
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-[15px] font-medium text-fg">No one has shared with you yet</p>
          <p className="mt-1.5 text-[13px] text-subtle">A student creates an invite in Settings, Family, and sends you the link.</p>
          <Link to="/app" className="mt-4 inline-block text-[13px] font-medium text-accent hover:underline">
            Go to my own ConcordiaTracker
          </Link>
        </div>
      </Shell>
    )
  }
  return (
    <FamilyShell students={students} current={current} pick={pick}>
      {error ? (
        <p className="p-6 text-[13px] text-danger">{error}</p>
      ) : !data ? (
        <Centre><Loader2 size={18} className="animate-spin text-subtle" aria-hidden /></Centre>
      ) : (
        <Routes>
          <Route index element={<FamilyToday data={data} />} />
          <Route path="courses" element={<FamilyCourses data={data} />} />
          <Route path="courses/:courseId" element={<FamilyCourse data={data} />} />
          <Route path="calendar" element={<FamilyCalendar data={data} />} />
          <Route path="*" element={<Navigate to="/family" replace />} />
        </Routes>
      )}
    </FamilyShell>
  )
}

function Centre({ children }: { children: React.ReactNode }) {
  return <div className="grid h-[60vh] place-items-center">{children}</div>
}
