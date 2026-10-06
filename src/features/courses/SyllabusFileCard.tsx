import { useEffect, useState } from 'react'
import { ExternalLink, FileText } from 'lucide-react'
import type { Course } from '@/data/types'
import { Card } from '@/components/ui/Card'
import { ModalShell } from '@/command/ModalShell'
import { courseFileUrl, listCourseFiles, type CourseFile } from './course-files'

/**
 * The syllabus a course was imported from, openable from the course page.
 * Shows nothing at all when there is no stored file (older imports, courses
 * added by hand), rather than an empty card asking for one.
 */
export function SyllabusFileCard({ course }: { course: Course }) {
  const [files, setFiles] = useState<CourseFile[]>([])
  const [open, setOpen] = useState<{ file: CourseFile; url: string } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    listCourseFiles(course.id)
      .then((f) => !cancelled && setFiles(f.filter((x) => x.kind === 'syllabus')))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [course.id])

  const show = async (file: CourseFile) => {
    setFailed(false)
    const url = await courseFileUrl(file.path)
    if (url) setOpen({ file, url })
    else setFailed(true)
  }

  if (files.length === 0) return null
  const latest = files[0]
  return (
    <>
      <Card className="overflow-hidden">
        <button
          type="button"
          onClick={() => void show(latest)}
          className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors duration-150 hover:bg-surface-2"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-danger/10 text-danger">
            <FileText size={17} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-fg">Syllabus</span>
            <span className="block truncate text-[12px] text-subtle">{latest.name}</span>
          </span>
        </button>
        {failed && <p className="px-3.5 pb-2.5 text-[12px] text-danger">It could not be opened. Try again in a moment.</p>}
      </Card>

      {open && (
        <ModalShell label={`${course.code} syllabus`} onClose={() => setOpen(null)} widthClass="sm:max-w-5xl" scroll={false}>
          <div className="flex h-[85vh] flex-col">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-fg">{open.file.name}</p>
              <a
                href={open.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-medium text-muted hover:bg-surface-2 hover:text-fg"
              >
                <ExternalLink size={14} aria-hidden />
                Open in new tab
              </a>
            </div>
            {/* The browser's own PDF viewer: search, zoom and print come with it. */}
            <iframe title={`${course.code} syllabus`} src={open.url} className="min-h-0 w-full flex-1 bg-surface-2" />
          </div>
        </ModalShell>
      )}
    </>
  )
}
