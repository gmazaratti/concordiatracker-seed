/**
 * The three feature cards. `body` is the short line on the card; `intro` and
 * `points` are what the expanded view adds on desktop: one line, then four
 * labelled points a reader can scan (each under 120 characters). Every
 * sentence describes what the live product does, the same rule the docs follow.
 */
export type Point = { label: string; text: string }

export type Card = {
  title: string
  body: string
  intro: string
  points: Point[]
  video: string
  /** The layout alternates: media left, then text left, then media left. */
  mediaFirst: boolean
}

export const CARDS: Card[] = [
  {
    title: 'Upload your outline, get every deadline dated',
    body: 'Drop in your course outline PDF and ConcordiaTracker pulls out every assessment, its weight and its due date, so you check a list instead of retyping a syllabus.',
    intro: 'Your syllabus, read for you in a few seconds.',
    points: [
      { label: 'Every assessment', text: 'Assignments, quizzes and exams come out with their weights and due dates.' },
      { label: 'You review first', text: 'Nothing is saved until you check the list, and anything that looks off can be fixed.' },
      { label: 'No guessed dates', text: 'A date the outline does not give stays blank for you to fill in.' },
      { label: 'No duplicates', text: 'If the course is already in your list, the items join it instead of making a copy.' },
    ],
    // The real syllabus-parse flow, recorded on the live app (COMM 305).
    video: '/dev-landing-2/syllabus-parse.mp4',
    mediaFirst: true,
  },
  {
    title: 'Import a class, then make it yours',
    body: 'Find your class in the blueprints, import its outline, then edit the details and enter grades as they come back.',
    intro: 'Start from an outline someone already shared, then make the class yours.',
    points: [
      { label: 'Find it', text: 'Search the blueprints for your course, shared by a classmate or published with the course.' },
      { label: 'Import it', text: 'The class arrives with every assessment, weight and date already filled in.' },
      { label: 'Edit anything', text: 'Change any detail of the class or its assessments to match your section.' },
      { label: 'Track grades', text: 'Enter percentages or raw scores like 17/20 and see your standing and what you still need.' },
    ],
    // Recorded on the live app: Courses, a blueprint import (COMM 213), editing and grading it.
    video: '/dev-landing-2/courses-grades.mp4',
    mediaFirst: false,
  },
  {
    title: 'Moodle deadlines, pulled in for you',
    body: 'Paste your Moodle calendar link once and dated Moodle events land in your calendar, checked again every night. When a professor moves a date, you see the old and new date side by side.',
    intro: 'Your Moodle deadlines, in the same calendar as everything else.',
    points: [
      { label: 'One link', text: 'In Moodle, open Calendar, then Export, then Get calendar URL, and paste it in Settings.' },
      { label: 'Checked nightly', text: 'Dated Moodle events land on their own calendar layer and are checked again every night.' },
      { label: 'Moved dates', text: 'When a professor moves a date, you see the old and new date side by side.' },
      { label: 'Read only', text: 'It never needs your Moodle password and cannot read your grades or submissions.' },
    ],
    // The Moodle setup walkthrough already served by the docs and Settings.
    video: '/moodle/setup.mp4',
    mediaFirst: true,
  },
]
