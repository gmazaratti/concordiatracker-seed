import { Link } from 'react-router-dom'
import { useAppData } from '@/app/providers/app-data'
import { useTeacher } from '@/app/providers/teacher'
import { CourseChip } from '@/components/CourseChip'
import { AnnouncementMeta } from '@/components/AnnouncementMeta'

/** A quiet cross-course announcements digest on Today — recent teacher posts at a
 * glance, each linking back to its course detail (the source of truth). This is
 * the student's OWN coursework, so it belongs with Today's academic glance, not in
 * the outward-facing Community feed. Deliberately light. */
export function AnnouncementsDigest() {
  const { courseById } = useAppData()
  const { teacherAnnouncements } = useTeacher()
  // Newest first — teacher posts + seeded ones now all live in the provider.
  const items = [...teacherAnnouncements].sort((a, b) => a.postedDaysAgo - b.postedDaysAgo)

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
          {items.map((an) => {
            const course = courseById(an.courseId)
            return (
              <li key={an.id}>
                <Link
                  to={`/app/courses/${an.courseId}`}
                  className="block px-4 py-3 transition-colors duration-150 hover:bg-surface-2/40"
                >
                  <div className="flex items-center gap-2">
                    {course && <CourseChip code={course.code} color={course.color} />}
                    {course && <span className="text-[12px] text-subtle">{course.instructor.name}</span>}
                    <AnnouncementMeta a={an} className="ml-auto" />
                  </div>
                  <p className="mt-1.5 text-[13px] leading-snug font-medium text-fg">{an.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-subtle">{an.body}</p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
