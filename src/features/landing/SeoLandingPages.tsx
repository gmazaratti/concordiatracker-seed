import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { usePageMeta } from '@/app/hooks/usePageMeta'
import { GRADE_SCALE } from '@/lib/grade-scale'
import { SEO_PAGES, type SeoPageData } from './seo-pages-data'

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

/** Concordia's grade scale as a table: letter, grade points, common percentage.
 * The same rows the GPA maths uses, so the page cannot disagree with the app. */
function GradeScaleTable() {
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-[14px] tabular-nums">
        <caption className="sr-only">Concordia 4.30 grade scale</caption>
        <thead className="bg-surface-2 text-[12px] tracking-wide text-subtle uppercase">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-semibold">Letter</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Grade points</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Common percentage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {GRADE_SCALE.map((b, i) => {
            const top = i === 0 ? 100 : GRADE_SCALE[i - 1].min - 1
            return (
              <tr key={b.letter}>
                <th scope="row" className="px-4 py-2 font-semibold text-fg">{b.letter}</th>
                <td className="px-4 py-2 text-fg">{b.points.toFixed(2)}</td>
                <td className="px-4 py-2 text-muted">{b.min === 0 ? 'below 50' : `${b.min}–${top}`}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Shared layout for the keyword-targeted landing pages: a focused hero (one
 * h1), body sections (h2s), an FAQ, and a closing CTA with internal links. The
 * words come from seo-pages-data.ts, which the build also writes as HTML. */
function SeoPage({ page }: { page: SeoPageData }) {
  usePageMeta({ title: page.title, description: page.description, path: page.path })
  return (
    <>
      <section className="relative overflow-hidden px-5 pt-16 pb-12 sm:pt-24">
        <div className="ct-grid-bg pointer-events-none absolute inset-0 -z-10" aria-hidden />
        <div className="mx-auto w-full max-w-3xl">
          <p className="text-[12px] font-medium tracking-[0.22em] text-subtle uppercase">For Concordia students</p>
          <h1 className="mt-4 font-display text-[clamp(2.2rem,5vw,3.4rem)] leading-[1.05] font-medium tracking-tight text-fg">
            {page.h1}
          </h1>
          <p className="mt-5 max-w-xl text-[clamp(1rem,1.4vw,1.15rem)] leading-relaxed text-muted">{page.intro}</p>
          <Link to={page.cta.to} className="mt-8 inline-block">
            <Button size="lg" className="group">
              {page.cta.label}
              <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Button>
          </Link>
        </div>
      </section>

      <section className="border-t border-border/60 px-5 py-20 sm:py-24">
        <div className="mx-auto w-full max-w-3xl space-y-14">
          {page.sections.map((s) => (
            <article key={s.h2}>
              <h2 className="font-display text-[clamp(1.5rem,3vw,2.1rem)] leading-tight font-medium text-fg">{s.h2}</h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted">{s.body}</p>
              {s.scaleTable && <GradeScaleTable />}
            </article>
          ))}
        </div>
      </section>

      <FaqSection heading="Common questions" faqs={page.faqs} />

      <section className="border-t border-border/60 px-5 py-24 sm:py-28">
        <div className="mx-auto w-full max-w-2xl text-center">
          <h2 className="font-display text-[clamp(1.8rem,4vw,2.6rem)] leading-tight font-medium text-fg">
            See it on your own courses.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">Free to start, built for Concordia.</p>
          <Link to={page.cta.to} className="mt-7 inline-block">
            <Button size="lg" className="group">
              {page.cta.label}
              <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Button>
          </Link>
          <p className="mt-8 text-[13px] text-subtle">
            More: <Link to="/" className="font-medium text-accent hover:underline">ConcordiaTracker home</Link>
            {page.related.map((r) => (
              <span key={r.to}>
                {' · '}
                <Link to={r.to} className="font-medium text-accent hover:underline">{r.label}</Link>
              </span>
            ))}
          </p>
        </div>
      </section>
    </>
  )
}

export function ConcordiaGpaCalculatorPage() {
  return <SeoPage page={SEO_PAGES.gpa} />
}

export function ConcordiaSyllabusTrackerPage() {
  return <SeoPage page={SEO_PAGES.syllabus} />
}

export function ConcordiaScheduleBuilderPage() {
  return <SeoPage page={SEO_PAGES.schedule} />
}
