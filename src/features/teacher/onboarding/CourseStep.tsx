import { useEffect, useState } from 'react'
import { BookOpen, Check, Search } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import type { TeacherAccount } from '@/data/teacher'
import { searchCourses, type CatalogCourse } from '@/lib/catalog'
import { useT } from '@/i18n/i18n'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { FIELD } from './field'

/* ── 2. The section you teach ─────────────────────────────────────────────── */

/**
 * Concordia's own course calendar, not a free-text box, so the code and title
 * match what students have. The section is asked separately because that is
 * what students' outlines are keyed on, and nothing here can know it.
 */
export function CourseStep({ teacher, onAdded }: { teacher: TeacherAccount; onAdded: (id: string) => void }) {
  const t = useT()
  const { createCourse } = useTeacher()
  const [manual, setManual] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogCourse[]>([])
  const [picked, setPicked] = useState<{ code: string; title: string } | null>(null)
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [section, setSection] = useState('')

  const q = query.trim()
  useEffect(() => {
    if (!q || picked) return
    let active = true
    const id = setTimeout(async () => {
      const rows = await searchCourses(q, 8).catch(() => [])
      if (active) setResults(rows)
    }, 220)
    return () => {
      active = false
      clearTimeout(id)
    }
  }, [q, picked])
  const shown = q ? results : []

  const chosen = manual ? { code: code.trim().toUpperCase(), title: title.trim() } : picked
  const sec = section.trim().toUpperCase()
  const duplicate =
    !!chosen && teacher.courses.some((c) => c.code === chosen.code && c.section.toUpperCase() === sec)
  const ready = !!chosen?.code && !!chosen.title && !!sec && !duplicate

  function add() {
    if (!ready || !chosen) return
    onAdded(createCourse({ code: chosen.code, title: chosen.title, section: sec }))
    setPicked(null)
    setQuery('')
    setSection('')
    setCode('')
    setTitle('')
  }

  return (
    <div className="mt-5 flex flex-col gap-3">
      {teacher.courses.length > 0 && (
        <div>
          <p className="mb-1.5 text-[12px] font-medium text-muted">{t('teacherSetup.course.added')}</p>
          <ul className="flex flex-col gap-1.5">
            {teacher.courses.map((c) => (
              <li key={c.courseId} className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2">
                <Check size={14} className="shrink-0 text-accent" aria-hidden />
                <span className="text-[13px] font-medium text-fg">{c.code}</span>
                <span className="min-w-0 truncate text-[12px] text-subtle">{c.title}</span>
                <span className="ml-auto shrink-0 text-[12px] text-muted">
                  {t('teacherSetup.course.sectionLabel', { s: c.section })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {manual ? (
        <div className="flex flex-col gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('teacherSetup.course.codePlaceholder')} aria-label={t('teacherSetup.course.code')} className={FIELD} />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('teacherSetup.course.courseTitle')} aria-label={t('teacherSetup.course.courseTitle')} className={FIELD} />
        </div>
      ) : picked ? (
        <div className="flex items-center gap-2.5 rounded-lg border border-accent/50 bg-accent-soft px-3 py-2.5">
          <BookOpen size={15} className="shrink-0 text-accent" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-fg">{picked.code}</span>
            <span className="block truncate text-[12px] text-muted">{picked.title}</span>
          </span>
          <button type="button" onClick={() => setPicked(null)} className="shrink-0 text-[12px] font-medium text-accent hover:underline">
            {t('teacherSetup.course.change')}
          </button>
        </div>
      ) : (
        <div>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('teacherSetup.course.search')}
              aria-label={t('teacherSetup.course.search')}
              className={cn(FIELD, 'pl-9')}
            />
          </div>
          {q && (
            <ul className="mt-1.5 flex max-h-56 flex-col overflow-y-auto rounded-lg border border-border bg-surface">
              {shown.length === 0 ? (
                <li className="px-3 py-3 text-[12.5px] text-subtle">{t('teacherSetup.course.noMatch', { q })}</li>
              ) : (
                shown.map((c) => {
                  const cc = `${c.subject} ${c.catalog}`
                  return (
                    <li key={c.id} className="border-t border-border first:border-t-0">
                      <button
                        type="button"
                        onClick={() => setPicked({ code: cc, title: c.title })}
                        className="flex w-full items-baseline gap-2.5 px-3 py-2 text-left transition-colors hover:bg-surface-2"
                      >
                        <span className="shrink-0 text-[13px] font-medium text-fg">{cc}</span>
                        <span className="min-w-0 truncate text-[12px] text-subtle">{c.title}</span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          )}
        </div>
      )}

      {(picked || manual) && (
        <div className="flex items-end gap-2">
          <label className="block w-32">
            <span className="mb-1 block text-[12px] font-medium text-muted">{t('teacherSetup.course.section')}</span>
            <input value={section} onChange={(e) => setSection(e.target.value)} placeholder={t('teacherSetup.course.sectionPlaceholder')} maxLength={8} className={FIELD} />
          </label>
          <Button disabled={!ready} onClick={add}>
            {t('teacherSetup.course.add')}
          </Button>
        </div>
      )}
      {duplicate && <p className="text-[12px] text-warning">{t('teacherSetup.course.already')}</p>}

      <button
        type="button"
        onClick={() => {
          setManual((m) => !m)
          setPicked(null)
        }}
        className="self-start text-[12.5px] font-medium text-subtle transition-colors hover:text-fg"
      >
        {manual ? t('teacherSetup.course.manualBack') : t('teacherSetup.course.manual')}
      </button>
    </div>
  )
}
