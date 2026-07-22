import { useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Eye, ListChecks, Megaphone, ShieldCheck, Upload, type LucideIcon } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { useAppData } from '@/app/providers/app-data'
import type { Assessment } from '@/data/types'
import {
  outlineItemToAssessment,
  outlineWeight,
  sampleParsedOutline,
  teacherCourseToCourse,
  type OutlineItem,
} from '@/data/teacher'
import { term } from '@/data/mock'
import { SyllabusParseReveal } from '@/features/courses/SyllabusParseReveal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { OutlineEditor } from './OutlineEditor'
import { CommunityBlueprintsPanel } from './CommunityBlueprintsPanel'
import { StudentCoursePreview } from './StudentCoursePreview'
import { TeacherAnnouncementList } from './TeacherAnnouncementList'

const TABS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'outline', label: 'Course outline', icon: ListChecks },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'blueprints', label: 'Student blueprints', icon: ShieldCheck },
]

/** The course workspace — build/publish the outline + post announcements, split
 * into sub-tabs so a teacher can find each thing quickly. The published outline
 * IS the teacher-verified blueprint students see. Publish-only: no student data. */
export function TeacherCourseWorkspace() {
  const { courseId } = useParams()
  const { currentTeacher, updateOutline, publishCourse, postAnnouncement } = useTeacher()
  const { courseById } = useAppData()
  const [parsing, setParsing] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [params, setParams] = useSearchParams()

  if (!currentTeacher) return <Navigate to="/teacher" replace />
  const course = currentTeacher.courses.find((c) => c.courseId === courseId)
  if (!course) return <Navigate to="/teacher" replace />

  const section = TABS.find((t) => t.id === params.get('section'))?.id ?? 'outline'
  const select = (id: string) =>
    setParams(
      (p) => {
        p.set('section', id)
        return p
      },
      { replace: true },
    )

  const pending = currentTeacher.status === 'pending'
  const parseCourse = courseById(course.courseId) ?? teacherCourseToCourse(course)
  const weight = outlineWeight(course.outline)

  function onParsed(items: Assessment[]) {
    updateOutline(course!.courseId, items.map(toOutlineItem))
    setParsing(false)
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-6">
      <Link
        to="/teacher"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-fg"
      >
        <ArrowLeft size={16} aria-hidden />
        Dashboard
      </Link>

      <header className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-[24px] leading-tight font-semibold text-fg">
            {course.code} · Section {course.section}
          </h1>
          <p className="text-[13px] text-subtle">
            {course.title} · {term.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} disabled={course.outline.length === 0}>
            <Eye size={15} aria-hidden />
            Preview as student
          </Button>
          {course.published ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-[12px] font-medium text-success">
              <ShieldCheck size={14} aria-hidden />
              Published
            </span>
          ) : (
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-muted">Draft</span>
          )}
        </div>
      </header>

      {pending && (
        <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-warning">
          <strong className="font-semibold">Pending approval.</strong> You can prepare your outline now —
          publishing unlocks once an admin approves your account.
        </div>
      )}

      {/* Sub-tabs */}
      <div role="tablist" aria-label="Course sections" className="mt-5 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = t.id === section
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => select(t.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150',
                active ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
              )}
            >
              <Icon size={15} aria-hidden />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="mt-5">
        {section === 'outline' && (
          <section>
            <p className="mb-3 text-[13px] text-subtle">
              The assessment schedule — assignments, quizzes, exams with weights + due dates. This becomes
              the verified blueprint students import.
            </p>
            {parsing ? (
              <SyllabusParseReveal
                course={parseCourse}
                items={sampleParsedOutline().map((o) => outlineItemToAssessment(o, course.courseId))}
                autoStart
                onComplete={onParsed}
              />
            ) : (
              <>
                <div className="mb-3">
                  <Button variant="outline" size="sm" onClick={() => setParsing(true)}>
                    <Upload size={15} aria-hidden />
                    Upload syllabus
                  </Button>
                  <span className="ml-2 text-[12px] text-subtle">or enter assessments manually below</span>
                </div>

                <OutlineEditor items={course.outline} onChange={(items) => updateOutline(course.courseId, items)} />

                <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
                  {course.published ? (
                    <p className="inline-flex items-center gap-2 text-[13px] font-medium text-success">
                      <Check size={16} aria-hidden />
                      Students see this outline — changes save live.
                    </p>
                  ) : (
                    <>
                      <Button
                        disabled={pending || course.outline.length === 0}
                        onClick={() => publishCourse(course.courseId)}
                        title={pending ? 'Pending approval' : undefined}
                      >
                        <ShieldCheck size={16} aria-hidden />
                        Publish outline
                      </Button>
                      <span className="text-[12px] text-subtle">
                        {pending
                          ? 'Approval needed to publish'
                          : weight === 100
                            ? 'Weights total 100% — ready to publish'
                            : `Weights total ${weight}% — you can still publish`}
                      </span>
                    </>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {section === 'announcements' && (
          <section>
            <p className="mb-3 text-[13px] text-subtle">
              Posts flow to the course detail page + students&rsquo; Today digest. Past posts are editable below.
            </p>
            <AnnouncementComposer
              disabled={pending}
              onPost={(title, body) => postAnnouncement({ courseCode: course.code, title, body })}
            />
            <TeacherAnnouncementList courseCode={course.code} disabled={pending} />
          </section>
        )}

        {section === 'blueprints' && <CommunityBlueprintsPanel course={course} disabled={pending} />}
      </div>

      <p className="mt-8 rounded-lg border border-border bg-surface/50 px-4 py-3 text-[12px] text-subtle">
        Publish-only — you contribute course content. You don&rsquo;t see student grades, standings, or who
        imported your outline.
      </p>

      {previewOpen && <StudentCoursePreview course={course} onClose={() => setPreviewOpen(false)} />}
    </div>
  )
}

function AnnouncementComposer({
  onPost,
  disabled,
}: {
  onPost: (title: string, body: string) => void
  disabled: boolean
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const canPost = !disabled && title.trim().length > 0 && body.trim().length > 0

  function submit() {
    if (!canPost) return
    onPost(title.trim(), body.trim())
    setTitle('')
    setBody('')
  }

  const field =
    'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none disabled:opacity-50'

  return (
    <div className="rounded-xl border border-border bg-surface p-3.5">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={disabled}
        placeholder="Announcement title"
        aria-label="Announcement title"
        className={field}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={disabled}
        placeholder="What do your students need to know?"
        aria-label="Announcement body"
        rows={2}
        className={cn(field, 'mt-2 resize-none')}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-subtle">
          {disabled ? 'Approval needed to post' : 'Visible on the course + Today'}
        </span>
        <Button size="sm" disabled={!canPost} onClick={submit}>
          <Megaphone size={14} aria-hidden />
          Post
        </Button>
      </div>
    </div>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────
function toOutlineItem(a: Assessment): OutlineItem {
  return { id: a.id, kind: a.kind, title: a.title, due: a.due, weight: a.weight }
}
