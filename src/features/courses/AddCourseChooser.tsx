import { useNavigate } from 'react-router-dom'
import { ChevronRight, Library, PencilLine, Upload, type LucideIcon } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { ModalShell } from '@/command/ModalShell'
import { useT } from '@/i18n/i18n'

/** "Add a course — choose your method." The grid's "+" card opens this; the
 * three methods all end at a course detail, just by different on-ramps. (The
 * header "Import syllabus" button skips this and goes straight to the blueprint
 * browser, so the two entry points stay distinct.) */
export function AddCourseChooser({ onClose }: { onClose: () => void }) {
  const t = useT()
  const navigate = useNavigate()
  const { createCourse } = useAppData()

  function go(path: string) {
    onClose()
    navigate(path)
  }
  async function createManually() {
    const id = await createCourse()
    onClose()
    if (id) navigate(`/app/courses/${id}`)
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
            onClick={createManually}
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
