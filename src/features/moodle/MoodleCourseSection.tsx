import { useState } from 'react'
import type { Course } from '@/data/types'
import { Card } from '@/components/ui/Card'
import { MoodleList } from './MoodleItems'
import { MoodleMark } from './MoodleBrand'
import { useMoodleGroups } from './moodle-groups'

/**
 * A course's Moodle items on its own page, past ones included.
 *
 * Before this, a Moodle deadline that did not match one of the course's
 * assessments showed on Today and in Calendar but never inside the course, and
 * past ones were only in Settings. Items that DID match are listed too, marked
 * "Same as …", so the list is the whole of what Moodle says about this class.
 *
 * Absent when Moodle has nothing for the class (or is not connected): an empty
 * Moodle box on every course would be an advert, not information.
 */
export function MoodleCourseSection({ course }: { course: Course }) {
  const { groups, pairedWith } = useMoodleGroups()
  const [now] = useState(() => Date.now())
  const items = groups.get(course.id) ?? []
  if (items.length === 0) return null

  return (
    <Card className="overflow-hidden rounded-3xl">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <MoodleMark className="size-5 text-[10px]" />
        <p className="flex-1 font-display text-[15.5px] font-semibold text-fg">From Moodle</p>
        <span className="text-[12.5px] text-muted">
          {items.length} item{items.length === 1 ? '' : 's'}
        </span>
      </div>
      <MoodleList items={items} pairedWith={pairedWith} now={now} />
    </Card>
  )
}
