import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAppData } from '@/app/providers/app-data'
import { useTeacher } from '@/app/providers/teacher'
import { normalizeCode } from '@/lib/supabase-adapters'
import { CourseChip } from '@/components/CourseChip'
import { AnnouncementMeta } from '@/components/AnnouncementMeta'
import type { Course } from '@/data/types'

/** A quiet cross-course announcements digest on Today — recent teacher posts at a
 * glance, each linking back to its course detail (the source of truth). Filtered
 * to the student's OWN courses by code (announcements key by course code, since a
 * teacher and a student hold different per-user course ids). */
export function AnnouncementsDigest() {
  const { courses } = useAppData()
  const { teacherAnnouncements } = useTeacher()

  const courseByCode = useMemo(() => {
    const m = new Map<string, Course>()
    for (const c of courses) if (c.code) m.set(normalizeCode(c.code), c)
    return m
  }, [courses])

  // Only announcements for the student's own courses, newest first.
  const items = teacherAnnouncements
    .map((an) => ({ an, course: courseByCode.get(an.courseCode) }))
    .filter((x): x is { an: (typeof teacherAnnouncements)[number]; course: Course } => !!x.course)
    .sort((a, b) => a.an.postedDaysAgo - b.an.postedDaysAgo)

  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-surface/50">
      <p className="border-b border-border/60 px-4 py-2.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        Announcements
      </p>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12px] text-subtle">
          No new announcements — you're all caught up.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map(({ an, course }) => (
            <li key={an.id}>
              <Link
                to={`/app/courses/${course.id}`}
                className="block px-4 py-3 transition-colors duration-150 hover:bg-surface-2/40"
              >
                <div className="flex items-center gap-2">
                  <CourseChip code={course.code} color={course.color} />
                  {course.instructor.name && (
                    <span className="text-[12px] text-subtle">{course.instructor.name}</span>
                  )}
                  <AnnouncementMeta a={an} className="ml-auto" />
                </div>
                <p className="mt-1.5 text-[13px] leading-snug font-medium text-fg">{an.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-subtle">{an.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
