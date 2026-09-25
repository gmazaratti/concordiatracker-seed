import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, LifeBuoy, Plus } from 'lucide-react'
import { usePageMeta } from '@/app/hooks/usePageMeta'
import { PublicHeader } from '@/components/PublicHeader'
import { Button } from '@/components/ui/Button'
import { useT } from '@/i18n/i18n'
import { RecordlyFooter } from '@/features/dev-landing-2/RecordlyFaqFooter'
import { FAQ_GROUPS, LINK_RE, aKey, plainAnswer, qKey } from './faq-data'

/**
 * `/faq`: the long-form FAQ the navbar links to. The homepage keeps its own
 * short FAQ section; this is where every question gets a full answer.
 *
 * LOCKED TO THE DARK BRAND, like the homepage it is reached from, so the
 * navbar does not change colour between the two. It uses the same navbar,
 * with Features pointing back at the homepage section.
 *
 * Answers are plain `<details>`: they open with no JavaScript, keyboard and
 * screen readers handle them natively, and a crawler reads every answer.
 */
export function FaqPage() {
  const t = useT()
  usePageMeta({ title: t('faqPage.metaTitle'), description: t('faqPage.metaDescription'), path: '/faq' })

  // FAQPage structured data, so a search result can show the answers.
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_GROUPS.flatMap((g) =>
      g.items.map((id) => ({
        '@type': 'Question',
        name: t(qKey(id)),
        acceptedAnswer: { '@type': 'Answer', text: plainAnswer(t(aKey(id))) },
      })),
    ),
  })

  return (
    <div id="top" data-theme="dark" className="min-h-[100dvh] overflow-x-clip bg-canvas font-sans text-fg antialiased">
      <PublicHeader
        lang="text"
        docs={false}
        cta="account"
        anchors={[
          { href: '/#features', label: 'Features' },
          { href: '/faq', label: 'FAQ' },
        ]}
      />
      <script type="application/ld+json">{jsonLd}</script>

      <main className="px-5 pt-14 pb-16 sm:pt-20">
        <div className="mx-auto w-full max-w-3xl">
          <p className="text-[12px] font-semibold tracking-[0.18em] text-accent uppercase">{t('faqPage.eyebrow')}</p>
          <h1 className="mt-3 font-display text-[clamp(2.2rem,5vw,3.25rem)] leading-[1.05] font-semibold tracking-tight">
            {t('faqPage.heading')}
          </h1>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-muted">{t('faqPage.intro')}</p>

          <nav aria-label={t('faqPage.jump')} className="mt-8 flex flex-wrap gap-2">
            {FAQ_GROUPS.map((g) => (
              <a
                key={g.id}
                href={`#${g.id}`}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:border-border-strong hover:text-fg"
              >
                {t(g.title)}
              </a>
            ))}
          </nav>

          <div className="mt-12 flex flex-col gap-12">
            {FAQ_GROUPS.map((g) => (
              <section key={g.id} id={g.id} aria-labelledby={`${g.id}-h`} className="scroll-mt-24">
                <h2 id={`${g.id}-h`} className="text-[20px] font-semibold tracking-tight">
                  {t(g.title)}
                </h2>
                <div className="mt-4 flex flex-col gap-2">
                  {g.items.map((id) => (
                    <details key={id} className="group rounded-xl border border-border bg-surface transition-colors duration-150 open:border-border-strong">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 text-[15px] font-medium text-fg [&::-webkit-details-marker]:hidden">
                        {t(qKey(id))}
                        <Plus size={17} className="shrink-0 text-subtle transition-transform duration-200 group-open:rotate-45" aria-hidden />
                      </summary>
                      <p className="px-4 pb-4 text-[14.5px] leading-relaxed text-muted">{withLinks(t(aKey(id)))}</p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <section className="mt-16 flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6 sm:flex-row sm:p-8">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <BookOpen size={22} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[19px] font-semibold tracking-tight">{t('faqPage.docsTitle')}</h2>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{t('faqPage.docsBody')}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {/* Plain anchors: /docs is static HTML outside the app. */}
              <a href="/docs">
                <Button className="group">
                  {t('faqPage.docsCta')}
                  <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                </Button>
              </a>
              <a href="/docs/support">
                <Button variant="outline">
                  <LifeBuoy size={16} aria-hidden />
                  {t('faqPage.supportCta')}
                </Button>
              </a>
            </div>
            </div>
          </section>
        </div>
      </main>

      <div className="px-5 pb-12">
        <RecordlyFooter />
      </div>
    </div>
  )
}

/** Turn `[label](href)` in an answer into links. Docs, mail and outside links
 *  are plain anchors; the app's own routes use the router. */
function withLinks(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(LINK_RE)) {
    const [whole, label, href] = m
    const at = m.index ?? 0
    if (at > last) out.push(text.slice(last, at))
    const cls = 'font-medium text-accent underline-offset-4 hover:underline'
    const spa = href.startsWith('/') && !href.startsWith('/docs')
    out.push(
      spa ? (
        <Link key={at} to={href} className={cls}>
          {label}
        </Link>
      ) : (
        <a key={at} href={href} className={cls}>
          {label}
        </a>
      ),
    )
    last = at + whole.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
