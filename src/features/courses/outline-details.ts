import type { Blueprint } from '@/data/blueprints'
import type { Course } from '@/data/types'

/**
 * What an outline can tell a course about itself, beyond its dates.
 *
 * Page one of every Concordia outline states the instructor, their email, their
 * office, their office hours and the classroom — and all of it was being thrown
 * away. A student imported six dated assessments and then typed the professor's
 * email in by hand, off the same PDF we had just read.
 *
 * THE RULE: only ever fill a BLANK field. An outline must never overwrite
 * something the student put there — they know their own class, and we are
 * reading a document that may be a term out of date. So this returns a patch
 * containing only the fields that are currently empty, and returns nothing at
 * all when there is nothing to add.
 *
 * Pure, so the precedence can be checked without a course page or a network.
 */
export function outlineDetails(bp: Blueprint, course: Course): Partial<Course> {
  const patch: Partial<Course> = {}

  const name = bp.instructor?.trim() ?? ''
  const email = bp.instructorEmail?.trim() ?? ''
  // Instructor is one field with two halves, so it is decided as one: filling
  // an email onto a DIFFERENT professor's name would be worse than filling
  // neither. Only touched when both halves of the existing value are empty.
  if ((name || email) && !course.instructor.name.trim() && !course.instructor.email.trim()) {
    patch.instructor = { name, email }
  }

  const hours = bp.officeHours?.trim()
  if (hours && !course.officeHours?.trim()) patch.officeHours = hours

  // "Where is this class" — the room, not the professor's office. The section
  // feed often publishes no room at all, which is why the outline is worth
  // reading for it.
  const room = bp.classroom?.trim()
  if (room && !course.location.trim()) patch.location = room

  return patch
}

/** Something to say after an import, naming what was filled rather than
 *  claiming more than happened. */
export function describeDetails(patch: Partial<Course>): string | null {
  const parts: string[] = []
  if (patch.instructor) parts.push('instructor')
  if (patch.officeHours) parts.push('office hours')
  if (patch.location) parts.push('room')
  if (parts.length === 0) return null
  const last = parts.pop() as string
  return parts.length ? `${parts.join(', ')} and ${last}` : last
}
