import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Library, Loader2, PencilLine, Upload, type LucideIcon } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { ModalShell } from '@/command/ModalShell'
import { useT } from '@/i18n/i18n'
import { findSameCourse } from '@/lib/course-match'
import { term as currentTerm } from '@/data/mock'

/** "Add a course — choose your method." The grid's "+" card opens this; the
 * three methods all end at a course detail, just by different on-ramps. (The
 * header "Import syllabus" button skips this and goes straight to the blueprint
 * browser, so the two entry points stay distinct.) */
export function AddCourseChooser({ onClose }: { onClose: () => void }) {
  const t = useT()
  const navigate = useNavigate()
  const { createCourse, courses } = useAppData()
  // "Create manually" used to insert a blank "Untitled course" on the first
  // click — one account ended up with four of them. It asks for the one thing
  // that makes a course a course first, and only then creates it.
  const [manual, setManual] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const existing = code.trim() ? findSameCourse(courses, code, currentTerm.name) : undefined

  function go(path: string) {
    onClose()
    navigate(path)
  }
  async function createManually() {
    if (!code.trim() || busy || existing) return
    setBusy(true)
    const id = await createCourse({ source: 'manual', code: code.trim().toUpperCase(), title: name.trim() })
    setBusy(false)
    onClose()
    if (id) navigate(`/app/courses/${id}`)
  }

  if (manual) {
    return (
      <ModalShell label={t('courses.createManually')} onClose={onClose}>
        <form
          className="p-5"
          onSubmit={(e) => {
            e.preventDefault()
            void createManually()
          }}
        >
          <button
            type="button"
            onClick={() => setManual(false)}
            className="mb-2 inline-flex items-center gap-1 text-[12.5px] text-muted transition-colors hover:text-fg"
          >
            <ArrowLeft size={13} aria-hidden />
            {t('courses.manualBack')}
          </button>
          <h2 className="font-display text-[19px] font-semibold text-fg">{t('courses.createManually')}</h2>
          <label className="mt-4 block text-[12.5px] font-medium text-fg" htmlFor="manual-code">
            {t('courses.manualCode')}
          </label>
          <input
            id="manual-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="RELI 230"
            autoFocus
            className="mt-1 w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          <p className="mt-1 text-[11.5px] text-subtle">{t('courses.manualCodeHint')}</p>
          <label className="mt-3 block text-[12.5px] font-medium text-fg" htmlFor="manual-name">
            {t('courses.manualName')}
          </label>
          <input
            id="manual-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[14px] text-fg focus:border-accent focus:outline-none"
          />
          {existing && (
            <p className="mt-3 text-[12.5px] text-warning">
              {t('courses.manualExists', { code: existing.code })}{' '}
              <button
                type="button"
                onClick={() => go(`/app/courses/${existing.id}`)}
                className="font-medium text-fg underline underline-offset-2"
              >
                {t('courses.manualOpen')}
              </button>
            </p>
          )}
          <button
            type="submit"
            disabled={!code.trim() || busy || !!existing}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-[13.5px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
            {t('courses.manualCreate')}
          </button>
        </form>
      </ModalShell>
    )
  }

  return (
    <ModalShell label={t('courses.addCourse')} onClose={onClose}>
      <div className="p-5">
        <h2 className="font-display text-[19px] font-semibold text-fg">{t('courses.addCourse')}</h2>
        <p className="mt-0.5 text-[13px] text-subtle">{t('courses.pickHow')}</p>

        <div className="mt-4 flex flex-col gap-2.5">
          <Option
            icon={Library}
            title={t('courses.findBlueprint')}
            desc={t('courses.findBlueprintDesc')}
            onClick={() => go('/app/courses/blueprints')}
          />
          <Option
            icon={Upload}
            title={t('courses.uploadSyllabus')}
            desc={t('courses.uploadSyllabusAi')}
            onClick={() => go('/app/courses/upload')}
          />
          <Option
            icon={PencilLine}
            title={t('courses.createManually')}
            desc={t('courses.createManuallyDesc')}
            onClick={() => setManual(true)}
          />
        </div>
      </div>
    </ModalShell>
  )
}

function Option({
  icon: Icon,
  title,
  desc,
  onClick,
}: {
  icon: LucideIcon
  title: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-3 text-left transition-colors duration-150 hover:border-accent/50 hover:bg-surface-2"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
        <Icon size={19} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-fg">{title}</span>
        <span className="block text-[12px] leading-snug text-subtle">{desc}</span>
      </span>
      <ChevronRight
        size={17}
        className="shrink-0 text-subtle transition-transform duration-150 group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  )
}
