import { Megaphone } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { AnnouncementMeta } from '@/components/AnnouncementMeta'

/** This course's announcements on the course detail — posted/edited from the
 * teacher portal. Renders nothing when there are none. */
export function CourseAnnouncements({ courseId }: { courseId: string }) {
  const { teacherAnnouncements } = useTeacher()
  const items = teacherAnnouncements
    .filter((a) => a.courseId === courseId)
    .sort((a, b) => a.postedDaysAgo - b.postedDaysAgo)

  if (items.length === 0) return null

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <p className="flex items-center gap-1.5 border-b border-border px-4 py-2.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        <Megaphone size={13} className="text-accent" aria-hidden />
        Announcements
      </p>
      <ul className="divide-y divide-border">
        {items.map((an) => (
          <li key={an.id} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-fg">{an.title}</span>
              <AnnouncementMeta a={an} className="ml-auto" />
            </div>
            <p className="mt-0.5 text-[12px] leading-snug text-subtle">{an.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
