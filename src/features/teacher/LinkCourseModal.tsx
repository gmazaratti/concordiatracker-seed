import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useTeacher } from '@/app/providers/teacher'
import { sectionsForCourse } from '@/data/blueprints'
import type { Course } from '@/data/types'
import { ModalShell } from '@/command/ModalShell'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

/** Link an existing catalog course (search → pick a section) or create a new one,
 * then jump into its workspace. */
export function LinkCourseModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { courses } = useAppData()
  const { currentTeacher, linkCourse, createCourse } = useTeacher()
  const [mode, setMode] = useState<'link' | 'create'>('link')
  const [query, setQuery] = useState('')

  const linkedIds = new Set(currentTeacher?.courses.map((c) => c.courseId))
  const available = courses.filter((c) => !linkedIds.has(c.id))
  const q = query.trim().toLowerCase()
  const matches = q
    ? available.filter(
        (c) => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q),
      )
    : available

  function link(course: Course, section: string) {
    linkCourse({ courseId: course.id, code: course.code, title: course.title, section })
    onClose()
    navigate(`/teacher/course/${course.id}`)
  }

  const field =
    'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

  return (
    <ModalShell label="Link or create a course" onClose={onClose}>
      <div className="p-4 sm:p-5">
        <h2 className="font-display text-[18px] font-semibold text-fg">Add a course</h2>
        <p className="mt-0.5 text-[12px] text-subtle">
          Link a section you teach, or create one that isn't in the catalog yet.
        </p>

        <div role="tablist" className="mt-3 mb-3 flex gap-1 rounded-lg bg-surface-2 p-1">
          {(['link', 'create'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors duration-150',
                mode === m ? 'bg-accent text-accent-contrast' : 'text-muted hover:text-fg',
              )}
            >
              {m === 'link' ? 'Link existing' : 'Create new'}
            </button>
          ))}
        </div>

        {mode === 'link' ? (
          <>
            <div className="relative mb-2.5">
              <Search
                size={15}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle"
                aria-hidden
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a course by code or name…"
                aria-label="Search a course"
                className={cn(field, 'pl-9')}
              />
            </div>

            {matches.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border-strong bg-surface/50 px-4 py-6 text-center text-[13px] text-subtle">
                {available.length === 0
                  ? "You've linked all of your catalog courses."
                  : `No course matches “${query}”.`}
              </p>
            ) : (
              <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
                {matches.map((c) => {
                  const sections = [...new Set([c.section, ...sectionsForCourse(c.id)])]
                  return (
                    <li key={c.id} className="rounded-lg border border-border bg-surface px-3.5 py-3">
                      <p className="text-[13px] font-medium text-fg">{c.code}</p>
                      <p className="truncate text-[12px] text-subtle">{c.title}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {sections.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => link(c, s)}
                            className="rounded-md border border-border bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-muted transition-colors duration-150 hover:border-accent/50 hover:bg-accent-soft hover:text-accent"
                          >
                            Section {s}
                          </button>
                        ))}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        ) : (
          <CreateCourseForm
            onCreate={(input) => {
              const id = createCourse(input)
              onClose()
              navigate(`/teacher/course/${id}`)
            }}
          />
        )}
      </div>
    </ModalShell>
  )
}

function CreateCourseForm({
  onCreate,
}: {
  onCreate: (input: { code: string; title: string; section: string }) => void
}) {
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [section, setSection] = useState('')
  const valid = code.trim() && title.trim() && section.trim()

  const field =
    'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Course code (e.g. COMM 217)"
          aria-label="Course code"
          className={field}
        />
        <input
          value={section}
          onChange={(e) => setSection(e.target.value)}
          placeholder="Section"
          aria-label="Section"
          className={cn(field, 'w-28')}
        />
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Course title"
        aria-label="Course title"
        className={field}
      />
      <Button
        className="mt-1 w-full"
        disabled={!valid}
        onClick={() =>
          valid && onCreate({ code: code.trim(), title: title.trim(), section: section.trim() })
        }
      >
        Create course
      </Button>
    </div>
  )
}
