import type { PhotoKey } from './resource-photos'
import type { Stage } from './resource-guide'
import { GUIDES_B } from './guides-b'

/**
 * Long-form guides, written for this app. Facts come from the offices listed in
 * resources.ts and the official pages each guide links; opinions are ours and
 * are worded as advice. No dates are written into a guide: dates change every
 * term, so a guide says where the date lives instead.
 */
export type Block =
  | { h: string }
  | { p: string }
  | { list: string[] }
  | { steps: { t: string; d: string }[] }
  | { tip: string }
  | { warn: string }
  /** A card that opens one office from resources.ts. */
  | { office: string }
  /** A link into the app. */
  | { app: { label: string; to: string } }

export interface Guide {
  slug: string
  title: string
  /** One line under the title, and on the card. */
  dek: string
  tag: string
  minutes: number
  photo: PhotoKey
  /** The card's tint, a fixed colour like course colours. */
  hex: string
  /** Who it is most useful to; drives the order of the shelf. */
  stages: Stage[]
  body: Block[]
  sources: { label: string; url: string }[]
}

const A: Guide[] = [
  {
    slug: 'first-semester',
    title: 'Your first semester, in order',
    dek: 'What to do in week one, by midterms and before finals, and what can wait.',
    tag: 'First year',
    minutes: 6,
    photo: 'plaza',
    hex: '#e2553f',
    stages: ['first'],
    body: [
      {
        p: 'Nobody hands you a list. The university assumes you will find each office when you need it, which usually means the week after you needed it. This is the list, in the order it matters.',
      },
      { h: 'Before classes start' },
      {
        steps: [
          {
            t: 'See your advisor',
            d: 'Not to be told what to take, but to have someone check that what you picked follows your program’s sequence. A course taken out of order can push a required one back a full year.',
          },
          {
            t: 'Find your rooms on both campuses',
            d: 'Check which campus each class is on. Some programs put you on Loyola and downtown in the same day, and the shuttle between them takes about half an hour.',
          },
          {
            t: 'Get your outlines in one place',
            d: 'Every course publishes an outline with all of its deadlines and how the grade is split. Put them all in before the first week ends and you will never be surprised by a midterm.',
          },
        ],
      },
      { app: { label: 'Add a course from its outline', to: '/app/courses' } },
      { h: 'The first two weeks' },
      {
        p: 'This is the only stretch of the term when changing your mind is free. You can swap sections, drop a course that is clearly wrong for you and add another, and get all of your money back for what you dropped. The date that ends this is called DNE, and it arrives sooner than it feels like it should.',
      },
      { tip: 'Open each course page here and look at "Drop and withdrawal dates". They are specific to your section.' },
      { office: 'Term dates and deadlines' },
      { h: 'By midterms' },
      {
        list: [
          'Book the Writing Centre for your first paper. It is free and it takes fifty minutes.',
          'If one course is going badly, go to the Student Success Centre now. Tutoring works when there is still a second midterm to improve on.',
          'If you need exam accommodations, register with the Access Centre early. Accommodations are arranged ahead of time, not on the day.',
          'Enter your grades as they come back. Knowing you need 61 on the final is far less stressful than guessing.',
        ],
      },
      { office: 'Student Success Centre' },
      { h: 'Before finals' },
      {
        p: 'There is a second deadline, DISC, usually a few weeks before the end of classes. Up to that date you can withdraw from a course you are going to fail. You still pay for it and it shows as DISC on your record, but it does not count in your GPA. After it, the grade you get is the grade you keep.',
      },
      {
        warn: 'Dropping below 12 credits makes you a part-time student. That can affect loans, bursaries and insurance, so talk to Financial Aid before you withdraw from anything.',
      },
      { h: 'What can wait' },
      {
        p: 'Co-op, exchanges, minors and career planning are all real and all worth it. None of them needs a decision in your first term. Get through one set of finals first.',
      },
    ],
    sources: [
      { label: 'New students: concordia.ca', url: 'https://www.concordia.ca/students/new.html' },
      { label: 'Term dates and deadlines', url: 'https://www.concordia.ca/students/registration/term-dates-deadlines.html' },
      { label: 'Academic advising', url: 'https://www.concordia.ca/students/registration/advising.html' },
    ],
  },
  {
    slug: 'first-year-mistakes',
    title: 'Seven mistakes first-years make',
    dek: 'Each one is quiet, costs real money or a real grade, and is easy to avoid once you know it exists.',
    tag: 'First year',
    minutes: 5,
    photo: 'study',
    hex: '#2f7fd1',
    stages: ['first', 'middle'],
    body: [
      { p: 'None of these come with a warning. That is what makes them expensive.' },
      {
        steps: [
          {
            t: 'Thinking "drop" means one thing',
            d: 'There are two deadlines. Before the first (DNE) you get a refund and the course disappears. Between the first and the second (DISC) you pay in full and the course stays on your record as a withdrawal. Students miss the first by a day and pay for a course they stopped attending.',
          },
          {
            t: 'Stopping going instead of dropping',
            d: 'Not attending is not withdrawing. If you never officially drop, you are graded on the work you did not hand in.',
          },
          {
            t: 'Falling under 12 credits without checking',
            d: 'Twelve credits in a term is full time. Below that, government aid, some bursaries and some insurance and permit conditions can change. Ask Financial Aid, or the International Students Office if you are on a study permit, before you drop the course that takes you under.',
          },
          {
            t: 'Reading the outline once',
            d: 'The outline is the contract for the course: every deadline, the weight of every piece of work, the late policy and whether you must pass the final to pass the course. Most "surprises" were on page two.',
          },
          {
            t: 'Waiting until you are failing to ask for help',
            d: 'The Writing Centre, tutoring and learning specialists are free and are busiest the week before finals, when it is too late to change much. Go after the first bad mark, not the last.',
          },
          {
            t: 'Not looking at your fee statement',
            d: 'Your account lists every charge, including the health and dental plan, which is billed in the fall. If you are already covered elsewhere there is a window to opt out, and it does not reopen. Birks can tell you what each line is.',
          },
          {
            t: 'Emailing the wrong office, twice',
            d: 'If you do not know who handles something, ask Birks first. Their job is to tell you which office it belongs to.',
          },
        ],
      },
      { office: 'Birks Student Service Centre' },
      { office: 'Financial Aid and Awards' },
      { tip: 'Radar, in the Planner, watches for several of these: under 12 credits, a crunch week, and a deadline about to pass.' },
      { app: { label: 'Open Radar', to: '/app/planner?tab=radar' } },
    ],
    sources: [
      { label: 'Term dates and deadlines', url: 'https://www.concordia.ca/students/registration/term-dates-deadlines.html' },
      { label: 'Birks Student Service Centre', url: 'https://www.concordia.ca/students/birks.html' },
      { label: 'Financial Aid and Awards', url: 'https://www.concordia.ca/students/financial.html' },
    ],
  },
  {
    slug: 'dropping-a-course',
    title: 'Dropping a course without paying for it',
    dek: 'DNE and DISC in plain words, and the three questions to answer before you do either.',
    tag: 'Registration',
    minutes: 4,
    photo: 'hall',
    hex: '#d99a1f',
    stages: ['first', 'middle', 'final'],
    body: [
      { h: 'The two dates' },
      {
        list: [
          'DNE (did not enter): the last day to drop with a full refund. The course is removed as if you never registered.',
          'DISC (discontinued): the last day to withdraw. You owe the full fees and the course stays on your record marked DISC, with no effect on your GPA.',
          'After DISC: you are in the course to the end, and the final grade counts.',
        ],
      },
      {
        p: 'Most sections share the term’s standard dates, but not all. A course that starts late, runs for half a term or is taught intensively has its own. Check the one for your section, not the one your friend told you.',
      },
      { tip: 'Each course page in this app shows the drop and withdrawal dates for your own section when the registrar publishes them.' },
      { h: 'Three questions before you drop' },
      {
        steps: [
          {
            t: 'Does it take me under 12 credits?',
            d: 'If yes, you become part time for the term. Check what that does to your aid or your permit first.',
          },
          {
            t: 'Is it a prerequisite for something next term?',
            d: 'Dropping a prerequisite can delay the course after it, and some courses are only offered once a year.',
          },
          {
            t: 'Can I still pass it?',
            d: 'Work out the mark you need on what is left. If it is over 100, the decision is made. If it is 70, it may be worth staying.',
          },
        ],
      },
      { app: { label: 'See what each course needs', to: '/app/courses' } },
      { h: 'How to actually do it' },
      {
        p: 'You drop or withdraw yourself, in the Student Hub, by the deadline. An email to the professor is polite but changes nothing. If something blocks you, Birks handles registration problems, and your advisor can tell you what the drop does to your sequence.',
      },
      { office: 'Student Hub' },
      { office: 'advising' },
    ],
    sources: [
      { label: 'Term dates and deadlines', url: 'https://www.concordia.ca/students/registration/term-dates-deadlines.html' },
      { label: 'Student Hub', url: 'https://www.concordia.ca/students.html' },
    ],
  },
]

export const GUIDES: Guide[] = [...A, ...GUIDES_B]

export function guideBySlug(slug: string | null): Guide | undefined {
  return slug ? GUIDES.find((g) => g.slug === slug) : undefined
}

/** The shelf order: guides written for this stage first, the rest after. */
export function guidesFor(stage: Stage): Guide[] {
  return [...GUIDES].sort((a, b) => Number(b.stages[0] === stage) - Number(a.stages[0] === stage))
}
