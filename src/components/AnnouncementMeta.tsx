import { agoLabel, postedOn, type Announcement } from '@/data/announcements'
import { cn } from '@/lib/cn'

/** The shared "Posted {date}" line with an "Edited · {when}" tag — shown to both
 * students and teachers wherever an announcement appears. */
export function AnnouncementMeta({ a, className }: { a: Announcement; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] text-subtle', className)}>
      {a.editedDaysAgo != null && (
        <span className="rounded bg-surface-2 px-1.5 py-0.5 font-medium text-muted">
          Edited · {agoLabel(a.editedDaysAgo)}
        </span>
      )}
      Posted {postedOn(a.postedDaysAgo)}
    </span>
  )
}
