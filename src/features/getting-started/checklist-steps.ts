import type { Assessment, Course } from '@/data/types'
import type { UiState } from '@/app/providers/ui-state'
import { isOpen } from '@/lib/status'
import { gradeToPercent } from '@/lib/grade'
import { DEFAULT_MAIN, DEFAULT_WIDGETS } from '@/features/today/widgets/registry'
import type { Step } from './checklist-parts'

/** The six first actions, each marked done from the student's real data. */
export function buildSteps(courses: Course[], assessments: Assessment[], uiState: UiState): Step[] {
  // Both steps happen INSIDE a course, and both used to link to the Courses
  // list — which is usually the page you are already on, so the link did
  // nothing at all. They open a real course now: the newest one for adding an
  // assignment, and one that has assessments for entering a grade.
  const newestCourse = courses[courses.length - 1]
  const gradable = courses.find((c) => assessments.some((a) => a.courseId === c.id)) ?? newestCourse
  const courseHref = (id: string | undefined) => (id ? `/app/courses/${id}` : '/app/courses')

  return [
    {
      id: 'course',
      label: 'Add a course',
      hint: 'Import a syllabus or pick a blueprint',
      done: courses.length > 0,
      to: '/app/courses',
    },
    {
      id: 'assignment',
      label: 'Add an assignment',
      hint: 'A deadline to track',
      done: assessments.length > 0,
      to: courseHref(newestCourse?.id),
    },
    {
      id: 'done',
      label: 'Mark one done',
      hint: 'Tap the circle on a task',
      done: assessments.some((a) => !isOpen(a.status)),
      to: '/app',
    },
    {
      id: 'grade',
      label: 'Enter a grade',
      hint: 'See your standing update',
      done: assessments.some((a) => gradeToPercent(a.grade) !== null),
      to: courseHref(gradable?.id),
    },
    {
      // Widgets are the app's feature directory (library seats, the shuttle,
      // weather, seat watch), and nobody finds them by accident: the button
      // sits at the foot of Today's rail. Done once anything beyond the
      // default layout is on Today, in either column.
      id: 'widget',
      label: 'Add a widget',
      hint: 'Library seats, shuttle times, weather and more',
      done: [...(uiState.todayWidgets ?? []), ...(uiState.todayMain ?? [])].some(
        (id) => !DEFAULT_WIDGETS.includes(id) && !DEFAULT_MAIN.includes(id),
      ),
      to: '/app?widgets=1',
    },
    {
      id: 'community',
      label: 'Explore Community',
      hint: 'Events around campus',
      done: !!uiState.communityVisited,
      to: '/app/community',
    },
  ]
}
