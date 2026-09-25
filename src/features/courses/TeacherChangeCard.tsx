import { ArrowRight, ShieldCheck } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import type { Assessment } from '@/data/types'
import { formatDueDateTime } from '@/lib/date'
import { useT } from '@/i18n/i18n'
import { Button } from '@/components/ui/Button'

/**
 * "Your teacher changed this", on the course page.
 *
 * An imported teacher-verified outline stays linked to the teacher's copy, and
 * a republish updates the student's items in the database
 * (db/teacher_features.sql). The update is APPLIED, not suggested, because
 * the teacher's outline is the official source; this card is how the student
 * finds out, with the old value beside the new so nothing moves unnoticed.
 * Got it clears it. Grades, status and notes were never touched.
 */
export function TeacherChangeCard({ items }: { items: Assessment[] }) {
  const t = useT()
  const { updateAssessment } = useAppData()
  if (items.length === 0) return null

  const ack = () => items.forEach((a) => updateAssessment(a.id, { teacherPrev: null }))

  return (
    <div className="rounded-xl border border-accent/40 bg-accent-soft/40 p-3">
      <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg">
        <ShieldCheck size={14} className="shrink-0 text-accent" aria-hidden />
        {t(items.length === 1 ? 'teacherChange.titleOne' : 'teacherChange.titleMany', { n: items.length })}
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((a) => {
          const p = a.teacherPrev ?? {}
          return (
            <li key={a.id} className="text-[12.5px]">
              <p className="font-medium text-fg">{a.title}</p>
              {'title' in p && p.title !== undefined && (
                <Change label={t('teacherChange.renamed')} from={p.title} to={a.title} />
              )}
              {'due' in p && (
                <Change
                  label={t('teacherChange.date')}
                  from={p.due ? formatDueDateTime(p.due) : t('teacherChange.noDate')}
                  to={a.due ? formatDueDateTime(a.due) : t('teacherChange.noDate')}
                />
              )}
              {'weight' in p && p.weight !== undefined && (
                <Change label={t('teacherChange.weight')} from={`${p.weight}%`} to={`${a.weight}%`} />
              )}
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-[11.5px] leading-relaxed text-subtle">{t('teacherChange.note')}</p>
      <Button className="mt-2.5" size="sm" onClick={ack}>
        {t('teacherChange.ack')}
      </Button>
    </div>
  )
}

function Change({ label, from, to }: { label: string; from: string; to: string }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <span className="text-subtle">{label}</span>
      <span className="rounded-md bg-surface-2 px-2 py-0.5 text-muted line-through decoration-subtle">{from}</span>
      <ArrowRight size={12} className="shrink-0 text-subtle" aria-hidden />
      <span className="rounded-md bg-accent-soft px-2 py-0.5 font-medium text-accent">{to}</span>
    </div>
  )
}
