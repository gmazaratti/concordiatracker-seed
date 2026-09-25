import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  BookOpen,
  Check,
  GraduationCap,
  ListChecks,
  PartyPopper,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import type { TeacherAccount } from '@/data/teacher'
import { useT } from '@/i18n/i18n'
import type { Key } from '@/i18n/en'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { NameStep, NextUp, OutlineStep, Pillars } from './steps'
import { CourseStep } from './CourseStep'
import { teacherStep } from './state'

/**
 * Setting up the teacher portal: the club wizard's flow, with a teacher's
 * content in it.
 *
 * SAME SHAPE ON PURPOSE. A rail of steps on the left (a progress bar and a
 * count on a phone), one question per screen, Save & continue, Do this later,
 * Back, and Skip on every screen: a setup nobody can get out of is a wall.
 * Nothing navigates away: adding a course and typing its outline happen here,
 * because leaving for another screen ends onboarding early.
 *
 * WHAT DIFFERS, AND WHY. The club flow opens by asking who is holding the
 * phone and ends by inviting the rest of the exec, because a club has owners
 * and a team. A teacher account has neither, so those two screens have no
 * honest equivalent here. In their place: the name students will see on the
 * outline, the section you teach, and the outline itself.
 *
 * SAVES PER STEP. The name is written on Save & continue; a course the moment
 * it is added; the outline as it is typed. Closing the tab keeps all of it.
 */

interface StepDef {
  id: 'welcome' | 'name' | 'course' | 'outline' | 'done'
  icon: LucideIcon
  /** Live completion, read off the account's real state. */
  isDone?: (t: TeacherAccount) => boolean
}

const STEPS: StepDef[] = [
  { id: 'welcome', icon: GraduationCap },
  { id: 'name', icon: UserRound },
  { id: 'course', icon: BookOpen, isDone: (t) => t.courses.length > 0 },
  {
    id: 'outline',
    icon: ListChecks,
    isDone: (t) => t.courses.some((c) => c.outline.some((i) => i.title.trim())),
  },
  { id: 'done', icon: PartyPopper },
]

const PRIMARY: Record<StepDef['id'], Key> = {
  welcome: 'teacherSetup.welcome.cta',
  name: 'teacherSetup.saveContinue',
  course: 'teacherSetup.continue',
  outline: 'teacherSetup.continue',
  done: 'teacherSetup.done.cta',
}

export function TeacherOnboarding({
  teacher,
  onClose,
}: {
  teacher: TeacherAccount
  onClose: () => void
}) {
  const t = useT()
  const { renameTeacher } = useTeacher()
  const [step, setStep] = useState(() => Math.min(teacherStep.get('step') ?? 0, STEPS.length - 1))
  const [name, setName] = useState(teacher.name)
  // The course the outline step edits: the one just added, else the newest.
  const [courseId, setCourseId] = useState<string | null>(null)

  const go = (n: number) => {
    teacherStep.set('step', n)
    setStep(n)
  }
  const advance = () => go(Math.min(step + 1, STEPS.length - 1))

  const s = STEPS[step]
  const last = step === STEPS.length - 1
  const blocked = s.id === 'name' && !name.trim()
  const label = (id: StepDef['id'], part: 'rail' | 'hint') => t(`teacherSetup.${id}.${part}` as Key)

  function primary() {
    if (last) {
      onClose()
      return
    }
    if (s.id === 'name' && name.trim() !== teacher.name) renameTeacher(name)
    advance()
  }

  return createPortal(
    // Opaque from the first frame: only the contents fade, so nothing behind
    // shows through while it appears (the club wizard's dashboard flash).
    <div className="fixed inset-0 z-[80] bg-canvas">
      <div className="ct-animate-fade relative isolate flex size-full">
        <div className="ct-grid-bg pointer-events-none absolute inset-0 -z-10" aria-hidden />

        <aside className="hidden w-[300px] shrink-0 flex-col border-r border-border bg-surface/40 p-5 lg:flex">
          <div className="flex items-center gap-2.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <GraduationCap size={19} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-fg">{name.trim() || teacher.name}</p>
              <p className="truncate text-[11.5px] text-subtle">{t('teacherSetup.portal')}</p>
            </div>
          </div>

          <ol className="mt-7 flex flex-col gap-1">
            {STEPS.map((def, i) => {
              const done = def.isDone?.(teacher) ?? false
              const current = i === step
              return (
                <li key={def.id}>
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-current={current ? 'step' : undefined}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors duration-150',
                      current ? 'bg-accent-soft' : 'hover:bg-surface-2/60',
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold',
                        done
                          ? 'bg-accent text-accent-contrast'
                          : current
                            ? 'border-2 border-accent text-accent'
                            : 'border-2 border-border-strong text-subtle',
                      )}
                    >
                      {done ? <Check size={13} strokeWidth={3} aria-hidden /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={cn('block text-[13px] font-medium', current ? 'text-fg' : 'text-muted')}>
                        {label(def.id, 'rail')}
                      </span>
                      <span className="block truncate text-[11px] text-subtle">{label(def.id, 'hint')}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>

          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="self-start text-[13px] font-medium text-subtle transition-colors hover:text-fg"
          >
            {t('teacherSetup.skipSetup')}
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          {/* On a phone the rail becomes a bar and a count, and Skip stays in reach. */}
          <div className="flex items-center gap-4 px-5 pt-[calc(1rem+env(safe-area-inset-top))] lg:hidden">
            <div className="flex flex-1 gap-1.5">
              {STEPS.map((def, i) => (
                <span
                  key={def.id}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors duration-300',
                    i <= step ? 'bg-accent' : 'bg-surface-2',
                  )}
                  aria-hidden
                />
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[13px] font-medium text-subtle transition-colors hover:text-fg"
            >
              {t('teacherSetup.skip')}
            </button>
          </div>

          <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-10">
            <div key={s.id} className="ct-animate-pop w-full max-w-md">
              {s.id === 'welcome' && <Pillars />}

              <h1
                className={cn(
                  'font-display text-[25px] leading-tight font-semibold text-fg',
                  s.id === 'welcome' && 'mt-6',
                )}
              >
                {t(`teacherSetup.${s.id}.title` as Key)}
              </h1>
              {s.id !== 'done' && (
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted">
                  {t(`teacherSetup.${s.id}.body` as Key)}
                </p>
              )}

              {s.id === 'name' && <NameStep name={name} setName={setName} />}
              {s.id === 'course' && <CourseStep teacher={teacher} onAdded={setCourseId} />}
              {s.id === 'outline' && (
                <OutlineStep
                  teacher={teacher}
                  courseId={courseId}
                  setCourseId={setCourseId}
                  onAddCourse={() => go(STEPS.findIndex((d) => d.id === 'course'))}
                />
              )}
              {last && <NextUp pending={teacher.status === 'pending'} />}

              <div className="mt-7 flex flex-wrap items-center gap-3">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => go(Math.max(step - 1, 0))}
                    aria-label={t('teacherSetup.back')}
                    className="grid size-11 place-items-center rounded-xl border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                  >
                    <ArrowLeft size={17} aria-hidden />
                  </button>
                )}
                <Button size="lg" disabled={blocked} onClick={primary}>
                  {t(PRIMARY[s.id])}
                </Button>
                {!last && s.id !== 'welcome' && (
                  <button
                    type="button"
                    onClick={advance}
                    className="text-[13px] font-medium text-subtle transition-colors hover:text-fg"
                  >
                    {t('teacherSetup.later')}
                  </button>
                )}
              </div>

              <p className="mt-6 text-[12px] text-subtle tabular-nums lg:hidden">
                {t('teacherSetup.stepOf', { n: step + 1, total: STEPS.length })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
