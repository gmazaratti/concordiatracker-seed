import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Logo } from '@/components/Logo'

/**
 * The FAQ and footer, with ConcordiaTracker's real questions.
 *
 * Every answer has to be true of the live product, the same rule the docs
 * follow: the free allowance, the pending state a new club sits in, and what
 * Moodle sync reads are all stated the way the code behaves, not the way a
 * marketing page would like them to.
 */
const QUESTIONS: { q: string; a: ReactNode }[] = [
  {
    q: 'How does syllabus parsing work?',
    a: (
      <>
        Upload your course outline PDF from Courses, then Add a course, then Upload a syllabus. ConcordiaTracker reads
        it and pulls out every assessment with its weight and due date, and shows you the list to check before anything
        is saved. A date the outline does not give is left blank for you to fill in, never guessed.
      </>
    ),
  },
  {
    q: 'How does the events feed work?',
    a: (
      <>
        Community is where student clubs and organizations publish. The Feed shows their posts and events, newest first,
        with the clubs you follow leading. Events lists the same events by date, with category filters. Open any event
        to add it to your calendar, set a reminder, or share it. Students follow and react; only organizations post.
      </>
    ),
  },
  {
    q: 'How does my club join?',
    a: (
      <>
        <Link to="/organizer/apply" className="font-semibold text-accent underline-offset-4 hover:underline">
          Apply to list your club
        </Link>
        . Sign in with the account you will run it from, then answer a few questions: the club&apos;s name and handle,
        what it does, how many members it has, your role, and a contact email. Your dashboard opens straight away so you
        can set up the profile and draft events. The club shows as pending, and nothing reaches students until we
        approve it.
      </>
    ),
  },
  {
    q: 'What is free, and what is paid?',
    a: (
      <>
        Free: every course, deadline tracking, grade entry, the grade-needed calculator, the calendar, Moodle sync,
        Community, and 5 syllabus scans a month. The Semester pass ($15 CAD a term, or $5 a month) adds GPA projection,
        a calendar feed for Google or Apple, term cost estimates, more themes, more seat watches, and no monthly scan
        limit.
      </>
    ),
  },
  {
    q: 'Does it connect to Moodle?',
    a: (
      <>
        Yes, one way. Paste your Moodle calendar link once, and dated Moodle events come into your calendar and are
        checked again every night. It reads your calendar only: never your password, grades or submissions.
      </>
    ),
  },
  {
    q: 'Is this affiliated with Concordia University?',
    a: <>No. ConcordiaTracker is an independent project built by students, for Concordia students.</>,
  },
]

const row = 'flex items-center justify-between gap-4 py-4 text-left text-[16px] font-semibold'

export function RecordlyFaq() {
  return (
    <section id="faq" className="mx-auto mt-40 grid w-full max-w-[1080px] scroll-mt-[96px] gap-8 md:grid-cols-[1fr_520px]">
      <div className="min-w-0">
        <p className="text-[14px] text-[#8b8b8b]">// FAQ</p>
        <h2 className="mt-2 text-[34px] leading-[1.1] tracking-[-0.04em] md:text-[40px]">
          Questions? <span className="text-[#8b8b8b]">We&apos;ve got answers.</span>
        </h2>
        <p className="mt-4 text-[16px] text-[#8b8b8b]">For support, message us from inside the app.</p>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        {QUESTIONS.map(({ q, a }) => (
          <details key={q} className="group rounded-[10px] bg-[#181816] px-4">
            <summary className={`${row} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
              {q}
              <Plus size={18} className="shrink-0 transition-transform duration-200 group-open:rotate-45" aria-hidden />
            </summary>
            <p className="pb-4 text-[15px] leading-[1.4] text-[#b4b4b4]">{a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

export function RecordlyFooter() {
  return (
    <footer className="mx-auto mt-40 flex w-full max-w-[1080px] flex-col gap-10 border-t border-white/10 pt-12 sm:flex-row sm:justify-between">
      <div className="min-w-0 max-w-[340px]">
        <a href="#top" className="inline-flex text-white" aria-label="Back to top">
          <Logo />
        </a>
        <p className="mt-3 text-[15px] leading-[1.4] text-[#8b8b8b]">
          Deadlines, grades and GPA, built for Concordia students.
        </p>
        <p className="mt-2 text-[13px] text-[#8b8b8b]">Not affiliated with Concordia University.</p>
      </div>
      <nav aria-label="Footer" className="min-w-0">
        <p className="text-[14px] font-semibold text-white">Navigation</p>
        <ul className="mt-3 flex flex-col gap-2 text-[15px] text-[#8b8b8b]">
          <li>
            <a href="#features" className="transition-colors hover:text-white">
              Features
            </a>
          </li>
          <li>
            <a href="#faq" className="transition-colors hover:text-white">
              FAQ
            </a>
          </li>
          <li>
            <a href="/docs/introduction" className="transition-colors hover:text-white">
              Docs
            </a>
          </li>
        </ul>
      </nav>
    </footer>
  )
}
