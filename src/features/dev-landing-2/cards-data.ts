/**
 * The three feature cards. `body` is the short line on the card; `detail` is
 * what the expanded view adds on desktop. Every sentence describes what the
 * live product does, the same rule the docs follow.
 */
export type Card = {
  title: string
  body: string
  detail: string[]
  video: string
  /** The layout alternates: media left, then text left, then media left. */
  mediaFirst: boolean
}

export const CARDS: Card[] = [
  {
    title: 'Upload your outline, get every deadline dated',
    body: 'Drop in your course outline PDF and ConcordiaTracker pulls out every assessment, its weight and its due date, so you check a list instead of retyping a syllabus.',
    detail: [
      'Upload the PDF your professor posted and it is read in a few seconds: every assignment, quiz and exam, with its weight and its due date.',
      'You review the list before anything is saved and can fix anything that looks off. A date the outline does not give stays blank for you to fill in, never guessed. If the course is already in your list, the items join it instead of creating a second copy.',
    ],
    // The real syllabus-parse flow, recorded on the live app (COMM 305).
    video: '/dev-landing-2/syllabus-parse.mp4',
    mediaFirst: true,
  },
  {
    title: 'Import a class, then make it yours',
    body: 'Find your class in the blueprints, import its outline, then edit the details and enter grades as they come back.',
    detail: [
      'Search the blueprints for your course and import an outline someone has already shared, from a classmate or published with the course. The class arrives with every assessment, weight and date filled in.',
      'From there it is yours: edit any detail, enter marks as percentages or raw scores like 17/20, and see your standing, a grade breakdown and the average you need on what is left, updated every time you save.',
    ],
    // Recorded on the live app: Courses, a blueprint import (COMM 213), editing and grading it.
    video: '/dev-landing-2/courses-grades.mp4',
    mediaFirst: false,
  },
  {
    title: 'Moodle deadlines, pulled in for you',
    body: 'Paste your Moodle calendar link once and dated Moodle events land in your calendar, checked again every night. When a professor moves a date, you see the old and new date side by side.',
    detail: [
      'In Moodle, open Calendar, then Export, and press Get calendar URL. Paste that link once in Settings and every dated Moodle event appears on its own layer of your calendar, and on Today when it is not already one of your course assessments.',
      'The link is checked again every night. When a professor moves a date you see the old and new date side by side, and when it matches a graded assessment you choose which date to keep. It never needs your Moodle password and cannot read your grades.',
    ],
    // The Moodle setup walkthrough already served by the docs and Settings.
    video: '/moodle/setup.mp4',
    mediaFirst: true,
  },
]
