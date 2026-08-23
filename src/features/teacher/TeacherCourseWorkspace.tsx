import { useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, Eye, ListChecks, Megaphone, ScrollText, ShieldCheck, Upload, type LucideIcon } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { useAppData } from '@/app/providers/app-data'
import type { Assessment } from '@/data/types'
import {
  TEACHER_SECTIONS,
  outlineItemToAssessment,
  outlineWeight,
  outlinesEqual,
  sampleParsedOutline,
  teacherCourseToCourse,
  type OutlineItem,
} from '@/data/teacher'
import { KIND_LABEL } from '@/lib/assessment'
import { tbdLabel } from '@/lib/date'
import { term } from '@/data/mock'
import { SyllabusParseReveal } from '@/features/courses/SyllabusParseReveal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { LangTabs } from '@/components/LangTabs'
import { mergeTranslations, type Translations } from '@/lib/localized'
import type { Lang } from '@/i18n/i18n'
import { OutlineEditor } from './OutlineEditor'
import { CommunityBlueprintsPanel } from './CommunityBlueprintsPanel'
import { StudentCoursePreview } from './StudentCoursePreview'
import { TeacherAnnouncementList } from './TeacherAnnouncementList'

const ICON: Record<string, LucideIcon> = {
  assignments: ListChecks,
  outline: ScrollText,
  announcements: Megaphone,
  blueprints: ShieldCheck,
}

/** The course workspace, split into sub-sections (driven by the sidebar on
 * desktop, a tab bar on mobile). Teachers edit their **assignments** freely; the
 * **outline** is the snapshot they publish as the blueprint students import. */
export function TeacherCourseWorkspace() {
  const { courseId } = useParams()
  const { currentTeacher, updateOutline, publishCourse, postAnnouncement } = useTeacher()
  const { courseById } = useAppData()
  const [parsing, setParsing] = useState(false)
  const [previewItems, setPreviewItems] = useState<OutlineItem[] | null>(null)
  const [params, setParams] = useSearchParams()

  if (!currentTeacher) return <Navigate to="/teacher" replace />
  const course = currentTeacher.courses.find((c) => c.courseId === courseId)
  if (!course) return <Navigate to="/teacher" replace />

  const section = TEACHER_SECTIONS.find((t) => t.id === params.get('section'))?.id ?? 'assignments'
  const sectionLabel = TEACHER_SECTIONS.find((t) => t.id === section)?.label ?? ''
  const select = (id: string) => setParams((p) => { p.set('section', id); return p }, { replace: true })

  const pending = currentTeacher.status === 'pending'
  const parseCourse = courseById(course.courseId) ?? teacherCourseToCourse(course)
  const weight = outlineWeight(course.outline)

  const shared = course.publishedOutline ?? []
  const hasShared = course.published && shared.length > 0
  const dirty = hasShared && !outlinesEqual(course.outline, shared)

  function onParsed(items: Assessment[]) {
    updateOutline(course!.courseId, items.map(toOutlineItem))
    setParsing(false)
  }
  const publish = () => publishCourse(course.courseId)

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-6">
      <Link to="/teacher" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-fg">
        <ArrowLeft size={16} aria-hidden />
        Dashboard
      </Link>

      <header className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-[24px] leading-tight font-semibold text-fg">
            {course.code} · Section {course.section}
          </h1>
          <p className="text-[13px] text-subtle">{course.title} · {term.name}</p>
        </div>
        {course.published ? (
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium', dirty ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success')}>
            {dirty ? <AlertTriangle size={14} aria-hidden /> : <ShieldCheck size={14} aria-hidden />}
            {dirty ? 'Unpublished changes' : 'Published'}
          </span>
        ) : (
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-muted">Draft</span>
        )}
      </header>

      {pending && (
        <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-warning">
          <strong className="font-semibold">Pending approval.</strong> You can prepare your outline now:
          publishing unlocks once an admin approves your account.
        </div>
      )}

      {/* Mobile tab bar (desktop uses the sidebar sub-tabs). */}
      <div role="tablist" aria-label="Course sections" className="mt-5 flex gap-1 overflow-x-auto border-b border-border md:hidden">
        {TEACHER_SECTIONS.map((t) => {
          const Icon = ICON[t.id]
          const active = t.id === section
          return (
            <button key={t.id} type="button" role="tab" aria-selected={active} onClick={() => select(t.id)}
              className={cn('inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150', active ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg')}>
              <Icon size={15} aria-hidden />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="mt-5">
        <h2 className="mb-3 hidden text-[16px] font-semibold text-fg md:block">{sectionLabel}</h2>

        {section === 'assignments' && (
          <section>
            <p className="mb-3 text-[13px] text-subtle">
              Add and edit your assessments here. When you&rsquo;re happy, publish them to the shared outline
              students import.
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
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setParsing(true)}>
                    <Upload size={15} aria-hidden />
                    Upload syllabus
                  </Button>
                  <Button variant="ghost" size="sm" disabled={course.outline.length === 0} onClick={() => setPreviewItems(course.outline)}>
                    <Eye size={15} aria-hidden />
                    Preview draft
                  </Button>
                  <span className="text-[12px] text-subtle">or enter assessments manually below</span>
                </div>

                <OutlineEditor items={course.outline} onChange={(items) => updateOutline(course.courseId, items)} />

                {/* Publish / update prompt */}
                <div className="mt-5 border-t border-border pt-4">
                  {!course.published ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <Button disabled={pending || course.outline.length === 0} onClick={publish} title={pending ? 'Pending approval' : undefined}>
                        <ShieldCheck size={16} aria-hidden />
                        Publish as shared outline
                      </Button>
                      <span className="text-[12px] text-subtle">
                        {pending ? 'Approval needed to publish' : weight === 100 ? 'Weights total 100%: ready to share' : `Weights total ${weight}%: you can still share`}
                      </span>
                    </div>
                  ) : dirty ? (
                    <div className="rounded-xl border border-warning/40 bg-warning/10 p-3.5">
                      <p className="text-[13px] font-medium text-warning">You&rsquo;ve changed your assignments.</p>
                      <p className="mt-0.5 text-[12px] text-warning/90">
                        Students still see the previously-shared outline until you update it.
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <Button size="sm" disabled={pending} onClick={publish}>
                          <ShieldCheck size={15} aria-hidden />
                          Update shared outline
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => select('outline')}>Compare on the Outline tab</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="inline-flex items-center gap-2 text-[13px] font-medium text-success">
                      <Check size={16} aria-hidden />
                      In sync: students see these assignments.
                    </p>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {section === 'outline' && (
          <section>
            <p className="mb-3 text-[13px] text-subtle">
              The outline students import as your verified blueprint. Edit assessments on the{' '}
              <button type="button" onClick={() => select('assignments')} className="font-medium text-accent hover:underline">Assignments</button>{' '}
              tab, then publish changes here.
            </p>
            {hasShared ? (
              <>
                {dirty && (
                  <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 p-3.5">
                    <p className="text-[13px] font-medium text-warning">Your assignments have changed since you last shared.</p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <Button size="sm" disabled={pending} onClick={publish}>
                        <ShieldCheck size={15} aria-hidden />
                        Update shared outline
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPreviewItems(course.outline)}>Preview the new version</Button>
                    </div>
                  </div>
                )}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-success">
                    <ShieldCheck size={15} aria-hidden />
                    Shared &amp; live · {shared.length} item{shared.length === 1 ? '' : 's'}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setPreviewItems(shared)}>
                    <Eye size={15} aria-hidden />
                    Preview as student
                  </Button>
                </div>
                <SharedOutlineList items={shared} />
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-border-strong p-8 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-xl bg-surface-2 text-subtle">
                  <ScrollText size={22} aria-hidden />
                </span>
                <h3 className="mt-3.5 text-[15px] font-semibold text-fg">No shared outline yet</h3>
                <p className="mx-auto mt-1 max-w-sm text-[13px] text-subtle">
                  Build your assessments, then publish them here so students can import your outline.
                </p>
                <Button className="mt-4" size="sm" onClick={() => select('assignments')}>
                  <ListChecks size={15} aria-hidden />
                  Go to Assignments
                </Button>
              </div>
            )}
          </section>
        )}

        {section === 'announcements' && (
          <section>
            <p className="mb-3 text-[13px] text-subtle">
              Posts flow to the course detail page + students&rsquo; Today digest. Past posts are editable below.
            </p>
            <AnnouncementComposer disabled={pending} onPost={(title, body, translations) => postAnnouncement({ courseCode: course.code, title, body, translations })} />
            <TeacherAnnouncementList courseCode={course.code} disabled={pending} />
          </section>
        )}

        {section === 'blueprints' && <CommunityBlueprintsPanel course={course} disabled={pending} />}
      </div>

      <p className="mt-8 rounded-lg border border-border bg-surface/50 px-4 py-3 text-[12px] text-subtle">
        Publish-only: you contribute course content. You don&rsquo;t see student grades, standings, or who
        imported your outline.
      </p>

      {previewItems && <StudentCoursePreview course={{ ...course, outline: previewItems }} onClose={() => setPreviewItems(null)} />}
    </div>
  )
}

/** Read-only list of the shared outline (what students import). */
function SharedOutlineList({ items }: { items: OutlineItem[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {items.map((o) => (
        <li key={o.id} className="flex items-center gap-3 px-3.5 py-2.5">
          <span className="w-20 shrink-0 text-[11px] font-medium tracking-wide text-subtle uppercase">{KIND_LABEL[o.kind]}</span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{o.title || 'Untitled'}</span>
          <span className="shrink-0 text-[12px] tabular-nums text-subtle">{dueLabel(o.due)}</span>
          <span className="w-12 shrink-0 text-right text-[12px] font-medium tabular-nums text-fg">{o.weight}%</span>
        </li>
      ))}
    </ul>
  )
}

function dueLabel(due: string | null): string {
  if (!due) return tbdLabel()
  const d = new Date(due)
  return isNaN(d.getTime()) ? tbdLabel() : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function AnnouncementComposer({
  onPost,
  disabled,
}: {
  onPost: (title: string, body: string, translations: Translations) => void
  disabled: boolean
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  // The French version of the same announcement. Posting is gated on the
  // default version only — a French copy is optional, and a blank one falls
  // back rather than publishing an empty announcement.
  const [lang, setLang] = useState<Lang>('en')
  const [frTitle, setFrTitle] = useState('')
  const [frBody, setFrBody] = useState('')

  const editingFr = lang === 'fr'
  const shownTitle = editingFr ? frTitle : title
  const shownBody = editingFr ? frBody : body
  const setShownTitle = editingFr ? setFrTitle : setTitle
  const setShownBody = editingFr ? setFrBody : setBody

  const canPost = !disabled && title.trim().length > 0 && body.trim().length > 0

  function submit() {
    if (!canPost) return
    onPost(
      title.trim(),
      body.trim(),
      mergeTranslations(undefined, 'fr', { title: frTitle, body: frBody }),
    )
    setTitle('')
    setBody('')
    setFrTitle('')
    setFrBody('')
    setLang('en')
  }

  const field = 'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none disabled:opacity-50'

  return (
    <div className="rounded-xl border border-border bg-surface p-3.5">
      <LangTabs
        value={lang}
        onChange={setLang}
        filled={frTitle.trim() || frBody.trim() ? ['fr'] : []}
        hint={
          editingFr
            ? 'Optional. Students reading in English still see the version above.'
            : 'The version every student sees unless they read in French.'
        }
      />
      <input
        value={shownTitle}
        onChange={(e) => setShownTitle(e.target.value)}
        disabled={disabled}
        placeholder={editingFr ? 'Titre de l’annonce' : 'Announcement title'}
        aria-label="Announcement title"
        className={field}
      />
      <textarea
        value={shownBody}
        onChange={(e) => setShownBody(e.target.value)}
        disabled={disabled}
        placeholder={editingFr ? 'Que doivent savoir vos étudiants ?' : 'What do your students need to know?'}
        aria-label="Announcement body"
        rows={2}
        className={cn(field, 'mt-2 resize-none')}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-subtle">{disabled ? 'Approval needed to post' : 'Visible on the course + Today'}</span>
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
