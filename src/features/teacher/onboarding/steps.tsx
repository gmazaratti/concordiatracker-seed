import {
  EyeOff,
  FileCheck2,
  Megaphone,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import type { TeacherAccount } from '@/data/teacher'
import { useT } from '@/i18n/i18n'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { cn } from '@/lib/cn'
import { OutlineEditor } from '../OutlineEditor'
import { FIELD } from './field'

/* ── Welcome ──────────────────────────────────────────────────────────────── */

export function Pillars() {
  const t = useT()
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <PillarRow icon={FileCheck2} title={t('teacherSetup.pillar.outline')} sub={t('teacherSetup.pillar.outlineSub')} />
      <PillarRow icon={Megaphone} title={t('teacherSetup.pillar.announce')} sub={t('teacherSetup.pillar.announceSub')} border />
      <PillarRow icon={EyeOff} title={t('teacherSetup.pillar.private')} sub={t('teacherSetup.pillar.privateSub')} border />
    </div>
  )
}

function PillarRow({ icon: Icon, title, sub, border }: { icon: LucideIcon; title: string; sub: string; border?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3 px-4 py-3', border && 'border-t border-border')}>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
        <Icon size={17} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-fg">{title}</p>
        <p className="truncate text-[11.5px] text-subtle">{sub}</p>
      </div>
    </div>
  )
}

/* ── 1. The name students see ─────────────────────────────────────────────── */

/** The club flow's handle step, for a teacher: the one identity field that
 *  reaches students, with a preview of the pin it will appear on. */
export function NameStep({ name, setName }: { name: string; setName: (v: string) => void }) {
  const t = useT()
  return (
    <div className="mt-5 flex flex-col gap-4">
      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-muted">{t('teacherSetup.name.label')}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('teacherSetup.name.placeholder')}
          maxLength={80}
          autoComplete="name"
          className={FIELD}
        />
      </label>
      <div>
        <p className="mb-1.5 text-[12px] font-medium text-muted">{t('teacherSetup.name.preview')}</p>
        <div className="flex items-center gap-2.5 rounded-xl border border-accent/40 bg-surface px-3.5 py-3">
          <ShieldCheck size={16} className="shrink-0 text-accent" aria-hidden />
          <span className="min-w-0 truncate text-[13.5px] font-medium text-fg">
            {name.trim() || t('teacherSetup.name.placeholder')}
          </span>
          <span className="ml-auto shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
            {t('teacherSetup.name.verified')}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── 3. The outline ───────────────────────────────────────────────────────── */

/** The club flow's first-event step: draft the first real thing, in place. It
 *  is the same editor the course page uses, so nothing has to be redone. */
export function OutlineStep({
  teacher,
  courseId,
  setCourseId,
  onAddCourse,
}: {
  teacher: TeacherAccount
  courseId: string | null
  setCourseId: (id: string) => void
  onAddCourse: () => void
}) {
  const t = useT()
  const { updateOutline } = useTeacher()
  const courses = teacher.courses
  const course = courses.find((c) => c.courseId === courseId) ?? courses[courses.length - 1]

  if (!course) {
    return (
      <div className="mt-5 rounded-xl border border-dashed border-border-strong bg-surface/50 px-4 py-5 text-center">
        <p className="text-[13px] text-subtle">{t('teacherSetup.outline.needCourse')}</p>
        <Button className="mt-3" variant="outline" size="sm" onClick={onAddCourse}>
          {t('teacherSetup.outline.goBack')}
        </Button>
      </div>
    )
  }

  return (
    <div className="mt-5">
      {courses.length > 1 ? (
        <label className="mb-3 block">
          <span className="mb-1 block text-[12px] font-medium text-muted">{t('teacherSetup.outline.for')}</span>
          <Select
            value={course.courseId}
            onChange={setCourseId}
            ariaLabel={t('teacherSetup.outline.for')}
            options={courses.map((c) => ({ value: c.courseId, label: `${c.code} · ${c.section}` }))}
          />
        </label>
      ) : (
        <p className="mb-3 text-[12.5px] text-muted">
          {t('teacherSetup.outline.for')}{' '}
          <span className="font-semibold text-fg">
            {course.code} · {course.section}
          </span>
        </p>
      )}
      <OutlineEditor items={course.outline} onChange={(items) => updateOutline(course.courseId, items)} />
    </div>
  )
}

/* ── What happens next ────────────────────────────────────────────────────── */

export function NextUp({ pending }: { pending: boolean }) {
  const t = useT()
  const items = [
    ...(pending ? [t('teacherSetup.done.pending')] : []),
    t('teacherSetup.done.preview'),
    t('teacherSetup.done.publish'),
    t('teacherSetup.done.announce'),
  ]
  return (
    <ul className="mt-4 space-y-2.5">
      {items.map((text, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-muted">
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[10.5px] font-semibold text-accent">
            {i + 1}
          </span>
          {text}
        </li>
      ))}
    </ul>
  )
}
