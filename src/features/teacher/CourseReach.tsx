import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { courseTracking, TRACKED_MIN } from '@/lib/catalog'

/**
 * "41 students track COMM 217". One number, no names.
 *
 * It is what makes publishing feel worth doing, and it is the same count
 * students see on the course picker (`course_tracking`), so the two can never
 * disagree. Per course code, not per section: that is how the count is kept,
 * and it is broad enough that it points at nobody. Below three it says so
 * rather than printing a number small enough to identify people.
 */
export function CourseReach({ code }: { code: string }) {
  const [n, setN] = useState<number | null>(null)
  useEffect(() => {
    let active = true
    courseTracking(code).then((r) => active && setN(r.tracked_by))
    return () => {
      active = false
    }
  }, [code])
  if (n === null) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
      <Users size={14} aria-hidden />
      {n >= TRACKED_MIN
        ? `${n} students track ${code} on ConcordiaTracker`
        : `Fewer than ${TRACKED_MIN} students track ${code} yet`}
    </span>
  )
}
