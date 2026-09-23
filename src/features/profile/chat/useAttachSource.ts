import { useMemo, useState } from 'react'
import { useAppData } from '@/app/providers/app-data'
import { useCommunity } from '@/features/community/useCommunity'
import { useRecordSnapshot } from '@/features/planner/useRecordSnapshot'
import type { SavedSchedule } from '@/lib/schedules'
import type { AttachSource } from '../AttachSheet'

/**
 * Everything you can send from a chat, in the shape the + sheet lists.
 *
 * `now` is read once into state rather than during render: the clock is
 * impure, and a memo that re-derives "upcoming" on every re-render can drop
 * an event out of the list mid-scroll. The record comes from the same hook
 * the export sheet uses, so what you send and what you print cannot drift.
 */
export function useAttachSource(schedules: SavedSchedule[]): AttachSource {
  const { courses } = useAppData()
  const { events } = useCommunity()
  const record = useRecordSnapshot()
  const [now] = useState(() => Date.now())

  return useMemo(() => {
    const term = courses.filter((c) => c.code.trim())
    return {
      classes: term.map((c) => ({ id: c.id, code: c.code, title: c.title, color: c.color, credits: c.credits })),
      schedules: [
        {
          id: 'current',
          name: 'My current schedule',
          classes: term.map((c) => ({
            code: c.code,
            // `?? ''` because the column is nullable — an `undefined` written
            // into the jsonb is a message that CRASHES the reader (MiniWeek).
            meets: c.meetingTimes ?? '',
            room: c.location || undefined,
            section: c.section || undefined,
          })),
        },
        ...schedules.map((sc) => ({
          id: sc.id,
          name: sc.name,
          classes: (sc.sections ?? []).map((p) => ({
            code: p.code,
            meets: p.section.meetingTimes ?? '',
            room: p.section.building ? `${p.section.building} ${p.section.room}`.trim() : p.section.room || undefined,
            section: p.section.section,
          })),
        })),
      ],
      events: events
        .filter((e) => new Date(e.start).getTime() > now)
        .slice(0, 6)
        .map((e) => ({ id: e.id, title: e.title, org: e.org.name })),
      record,
    }
  }, [courses, schedules, events, now, record])
}
