import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { usePageMeta } from '@/app/hooks/usePageMeta'

export interface Faq {
  q: string
  a: string
}

/** A semantic FAQ list that also injects FAQPage structured data (JSON-LD) for
 * rich snippets. The script is added imperatively so React doesn't HTML-escape
 * the JSON; it's removed on unmount so each route carries only its own. */
export function FaqSection({ heading, faqs }: { heading: string; faqs: Faq[] }) {
  useEffect(() => {
    const el = document.createElement('script')
    el.type = 'application/ld+json'
    el.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    })
    document.head.appendChild(el)
    return () => el.remove()
  }, [faqs])

  return (
    <section className="border-t border-border/60 px-5 py-24 sm:py-28">
      <div className="mx-auto w-full max-w-3xl">
        <h2 className="font-display text-[clamp(1.8rem,3.4vw,2.4rem)] leading-tight font-medium text-fg">
          {heading}
        </h2>
        <dl className="mt-10 space-y-8">
          {faqs.map((f) => (
            <div key={f.q}>
              <dt className="text-[16px] font-semibold text-fg">{f.q}</dt>
              <dd className="mt-2 text-[14.5px] leading-relaxed text-muted">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

/** Shared layout for the keyword-targeted landing pages: a focused hero (one
 * h1), body sections (h2s), an FAQ, and a closing CTA with internal links. */
function SeoPage({
  title,
  description,
  path,
  h1,
  intro,
  sections,
  faqs,
  related,
}: {
  title: string
  description: string
  path: string
  h1: string
  intro: string
  sections: { h2: string; body: React.ReactNode }[]
  faqs: Faq[]
  related: { to: string; label: string }
}) {
  usePageMeta({ title, description, path })
  return (
    <>
      <section className="relative overflow-hidden px-5 pt-16 pb-12 sm:pt-24">
        <div className="ct-grid-bg pointer-events-none absolute inset-0 -z-10" aria-hidden />
        <div className="mx-auto w-full max-w-3xl">
          <p className="text-[12px] font-medium tracking-[0.22em] text-subtle uppercase">For Concordia students</p>
          <h1 className="mt-4 font-display text-[clamp(2.2rem,5vw,3.4rem)] leading-[1.05] font-medium tracking-tight text-fg">
            {h1}
          </h1>
          <p className="mt-5 max-w-xl text-[clamp(1rem,1.4vw,1.15rem)] leading-relaxed text-muted">{intro}</p>
          <Link to="/app" className="mt-8 inline-block">
            <Button size="lg" className="group">
              Open the live demo
              <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Button>
          </Link>
        </div>
      </section>

      <section className="border-t border-border/60 px-5 py-20 sm:py-24">
        <div className="mx-auto w-full max-w-3xl space-y-14">
          {sections.map((s) => (
            <article key={s.h2}>
              <h2 className="font-display text-[clamp(1.5rem,3vw,2.1rem)] leading-tight font-medium text-fg">{s.h2}</h2>
              <div className="mt-4 text-[15px] leading-relaxed text-muted">{s.body}</div>
            </article>
          ))}
        </div>
      </section>

      <FaqSection heading="Common questions" faqs={faqs} />

      <section className="border-t border-border/60 px-5 py-24 sm:py-28">
        <div className="mx-auto w-full max-w-2xl text-center">
          <h2 className="font-display text-[clamp(1.8rem,4vw,2.6rem)] leading-tight font-medium text-fg">
            See it on your own courses.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">Jump into a live demo term — no sign-up needed.</p>
          <Link to="/app" className="mt-7 inline-block">
            <Button size="lg" className="group">
              Open the live demo
              <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Button>
          </Link>
          <p className="mt-8 text-[13px] text-subtle">
            More: <Link to="/" className="font-medium text-accent hover:underline">ConcordiaTracker home</Link>
            {' · '}
            <Link to={related.to} className="font-medium text-accent hover:underline">{related.label}</Link>
          </p>
        </div>
      </section>
    </>
  )
}

// ── /concordia-gpa-calculator ───────────────────────────────────────────────
const GPA_FAQS: Faq[] = [
  {
    q: 'What GPA scale does Concordia use?',
    a: "Concordia uses a 4.30 grade-point scale. ConcordiaTracker's GPA calculator is built on that exact scale, so the number you see matches your official transcript.",
  },
  {
    q: 'Can I see what grade I need to pass or hit a target?',
    a: 'Yes. Set any target and the free grade-needed calculator shows the average you need on your remaining assessments, using your real course weights.',
  },
  {
    q: 'Is the Concordia GPA calculator free?',
    a: 'The grade-needed-to-pass calculator and your full course dashboard are free. GPA what-if projection is part of the paid semester pass.',
  },
  {
    q: 'Does it work for any Concordia course?',
    a: 'Yes — any course or faculty. Import a shared outline, upload your syllabus, or enter your assessments by hand.',
  },
]

export function ConcordiaGpaCalculatorPage() {
  return (
    <SeoPage
      title="Concordia GPA Calculator | ConcordiaTracker"
      description="A free Concordia GPA calculator on the 4.30 scale. See your GPA, the grade you need on what's left to hit your target, and run what-if scenarios. Built for Concordia students."
      path="/concordia-gpa-calculator"
      h1="Concordia GPA Calculator"
      intro="Calculate your GPA on Concordia's official 4.30 scale, see exactly what you need on what's left to hit your target, and project where you'll land — without maintaining a spreadsheet."
      faqs={GPA_FAQS}
      related={{ to: '/concordia-syllabus-tracker', label: 'Concordia syllabus tracker' }}
      sections={[
        {
          h2: "Built on Concordia's 4.30 GPA scale",
          body: "ConcordiaTracker uses Concordia's official 4.30 grade-point scale, so the number you see is the number on your transcript — not an approximation. Enter your grades per assessment, weighted exactly how your syllabus lays them out, and your course grade and overall GPA update as you go.",
        },
        {
          h2: 'Know the exact grade you need',
          body: 'Set a target — a pass, a B+, whatever you’re aiming for — and the grade-needed calculator tells you the average you need on everything that’s left. It’s real arithmetic from your actual weights, and it’s free. No more guessing whether you can still pull off the grade you want.',
        },
        {
          h2: 'Project your GPA before the marks post',
          body: 'Run what-if scenarios: drop in the grades you expect and watch your GPA move before a single mark is official. It’s the difference between hoping and knowing where your semester is headed. (GPA prediction is part of the semester pass; the grade-needed calculator is always free.)',
        },
      ]}
    />
  )
}

// ── /concordia-syllabus-tracker ─────────────────────────────────────────────
const SYLLABUS_FAQS: Faq[] = [
  {
    q: 'How do I keep track of my Concordia syllabus?',
    a: 'Upload the syllabus and ConcordiaTracker extracts every deadline, weight, and exam automatically, then keeps them on one dashboard alongside your other courses.',
  },
  {
    q: 'Can it track assignments and deadlines across all my courses?',
    a: 'Yes. Every course’s deadlines land on a single Today view, sorted by what’s due next — your whole semester in one place.',
  },
  {
    q: "What if my course or syllabus isn't listed?",
    a: 'Upload your own syllabus to parse it, import a classmate’s outline, or add the course and its assessments by hand. Any Concordia course works.',
  },
  {
    q: 'Is the syllabus tracker free?',
    a: 'Yes — importing syllabi, tracking deadlines, and your course dashboard are all free.',
  },
]

export function ConcordiaSyllabusTrackerPage() {
  return (
    <SeoPage
      title="Concordia Syllabus Tracker | ConcordiaTracker"
      description="Upload any Concordia course syllabus and ConcordiaTracker auto-fills every deadline, weight, and exam. The syllabus, assignment, and deadline tracker built for Concordia students."
      path="/concordia-syllabus-tracker"
      h1="Concordia Syllabus Tracker"
      intro="Turn every course syllabus into a live plan — deadlines, weights, and exams filled in automatically — so your whole Concordia semester stays in one organized view."
      faqs={SYLLABUS_FAQS}
      related={{ to: '/concordia-gpa-calculator', label: 'Concordia GPA calculator' }}
      sections={[
        {
          h2: 'Upload a syllabus, skip the typing',
          body: 'Drop in a course syllabus and ConcordiaTracker reads it — pulling out every quiz, assignment, midterm, and final with its date and weight. No more copying a messy PDF into your calendar by hand in the first week of class.',
        },
        {
          h2: 'Every assignment and deadline in one place',
          body: 'Across all your courses, every due date lands on one Today view, sorted by what’s next. It’s an assignment tracker and deadline tracker for your entire Concordia term — so nothing buried in a syllabus catches you off guard.',
        },
        {
          h2: 'Trust every date',
          body: 'Each date carries a provenance badge — official, confirmed by classmates, or unverified — so you always know what to rely on. When a date you imported turns out wrong, classmates’ corrections keep it honest.',
        },
      ]}
    />
  )
}
