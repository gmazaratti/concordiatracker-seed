import { useEffect, useState } from 'react'
import { Trash2, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { TeacherCourse } from '@/data/teacher'
import { Button } from '@/components/ui/Button'

interface TaRow {
  id: string
  email: string
  user_id: string | null
  added_at: string
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * TAs on a course (db/teacher_features.sql, teacher_course_tas).
 *
 * Added by email. The TA signs in to the teacher portal with that address and
 * the course is there; nothing is sent, so tell them yourself. A TA edits the
 * draft outline; publishing stays with you, because the verified outline
 * carries your name.
 */
export function CourseTAs({ course, sandbox }: { course: TeacherCourse; sandbox: boolean }) {
  const [rows, setRows] = useState<TaRow[] | null>(null)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (sandbox) return
    let active = true
    void supabase
      .from('teacher_course_tas')
      .select('id, email, user_id, added_at')
      .eq('course_id', course.courseId)
      .order('added_at')
      .then(({ data }) => active && setRows((data as TaRow[] | null) ?? []))
    return () => {
      active = false
    }
  }, [course.courseId, tick, sandbox])

  if (sandbox) {
    return <p className="text-[13px] text-subtle">TAs can be added on your own account, not in the demo.</p>
  }
  if (course.ta) {
    return <p className="text-[13px] text-subtle">Only {course.ta.ownerName} can manage TAs on this course.</p>
  }

  async function add() {
    const e = email.trim().toLowerCase()
    if (!EMAIL_RE.test(e)) return setError('That does not look like an email address.')
    if (rows?.some((r) => r.email.toLowerCase() === e)) return setError('That person is already a TA here.')
    setError(null)
    const { error: err } = await supabase.from('teacher_course_tas').insert({ course_id: course.courseId, email: e })
    if (err) return setError('That TA could not be added. Try again.')
    setEmail('')
    setTick((n) => n + 1)
  }

  async function remove(id: string) {
    await supabase.from('teacher_course_tas').delete().eq('id', id)
    setTick((n) => n + 1)
  }

  return (
    <section>
      <p className="mb-3 text-[13px] text-subtle">
        A TA can edit this course&rsquo;s draft outline. Publishing and announcements stay with you.
        They sign in to the teacher portal with the email you add here; we don&rsquo;t email them, so let them know.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void add()}
          placeholder="ta@concordia.ca"
          aria-label="TA email"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none sm:max-w-xs"
        />
        <Button onClick={() => void add()} disabled={!email.trim()}>
          <UserPlus size={15} aria-hidden />
          Add TA
        </Button>
      </div>
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}

      <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
        {rows === null ? (
          <li className="px-4 py-3 text-[13px] text-subtle">Loading…</li>
        ) : rows.length === 0 ? (
          <li className="px-4 py-3 text-[13px] text-subtle">No TAs yet.</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-fg">{r.email}</span>
                <span className="block text-[11.5px] text-subtle">
                  {r.user_id ? 'Has signed in' : 'Not signed in yet'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void remove(r.id)}
                aria-label={`Remove ${r.email}`}
                className="grid size-8 place-items-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-danger"
              >
                <Trash2 size={15} aria-hidden />
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
