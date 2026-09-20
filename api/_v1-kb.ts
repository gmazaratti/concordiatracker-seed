/**
 * The knowledge base the assistant answers FROM.
 *
 * BUILT FROM THE DOCS, NOT A SECOND COPY OF THEM. A hand-maintained
 * `kb_articles` table would start identical to /docs and drift the first time
 * a page was edited — and the drift would be invisible, because nobody reads
 * a support KB looking for staleness. So the articles ARE the docs pages,
 * imported from the same module the static site is generated from, plus the
 * legal documents for the questions that are policy rather than product.
 *
 * That gives the assistant exactly what a person would be told to read, and
 * a `url` on every article so a reply can link the page rather than
 * paraphrasing it into something subtly different.
 */
// @ts-expect-error — plain .mjs data module, no types, imported for its content.
import { PAGES } from '../docs-src/content.mjs'
import { LEGAL_DOCS } from '../src/features/legal/legal-content.js'

export interface KbArticle {
  slug: string
  title: string
  url: string
  summary: string
  body: string
  tags: string[]
  source: 'docs' | 'policy' | 'app'
}

interface DocBlock {
  h2?: string
  h3?: string
  p?: string
  note?: string
  ul?: string[]
  ol?: string[]
  raw?: string
}
interface DocPage {
  title: string
  section: string
  description?: string
  blocks?: DocBlock[]
}

/** Blocks → plain prose. The assistant reads text, not markup. */
function flatten(blocks: DocBlock[] = []): string {
  const out: string[] = []
  for (const b of blocks) {
    if (b.h2) out.push(`\n## ${b.h2}`)
    else if (b.h3) out.push(`\n### ${b.h3}`)
    else if (b.p) out.push(b.p)
    else if (b.note) out.push(`Note: ${b.note}`)
    else if (b.ul) out.push(b.ul.map((x) => `- ${x}`).join('\n'))
    else if (b.ol) out.push(b.ol.map((x, i) => `${i + 1}. ${x}`).join('\n'))
    // `raw` is an interactive widget (the ticket lookup tool). Its markup is
    // not an answer to anything, so it is skipped rather than flattened into
    // noise the assistant might quote.
  }
  return out.join('\n\n').trim()
}

let cache: KbArticle[] | null = null

export function articles(): KbArticle[] {
  if (cache) return cache
  const out: KbArticle[] = []

  for (const [slug, page] of Object.entries(PAGES as Record<string, DocPage>)) {
    const body = flatten(page.blocks)
    if (!body) continue
    out.push({
      slug,
      title: page.title,
      url: `https://concordiatracker.com/docs/${slug}`,
      summary: page.description ?? '',
      body,
      tags: [page.section.toLowerCase()],
      source: 'docs',
    })
  }

  for (const [slug, doc] of Object.entries(LEGAL_DOCS)) {
    const body = doc.sections
      .map((s) => {
        const text = s.blocks
          .map((b) => {
            if (b.kind === 'p' || b.kind === 'highlight') return b.text
            if (b.kind === 'callout') return `${b.title ? `${b.title}: ` : ''}${b.text}`
            if (b.kind === 'list')
              return b.items
                .map((i) => (typeof i === 'string' ? `- ${i}` : `- ${i.label}: ${i.text}`))
                .join('\n')
            if (b.kind === 'links') return b.items.map((i) => `- ${i.label}: ${i.href}`).join('\n')
            return ''
          })
          .filter(Boolean)
          .join('\n\n')
        return `\n## ${s.n}. ${s.title}\n\n${text}`
      })
      .join('\n')
      .trim()
    out.push({
      slug: `legal-${slug}`,
      title: doc.title,
      url: `https://concordiatracker.com/${slug}`,
      summary: doc.intro ?? '',
      body,
      tags: ['policy', 'legal'],
      source: 'policy',
    })
  }

  cache = out
  return out
}

/**
 * Search. Deliberately a plain scored match rather than anything clever: the
 * corpus is a few dozen articles, the caller is a language model that will
 * read what comes back, and a fuzzy matcher that silently ranks the wrong
 * page first is worse than one whose behaviour is obvious.
 *
 * Scoring, highest first: the whole phrase in the title, a term in the title,
 * in the slug, in the summary, then in the body. **A body hit counts once per
 * article, not once per occurrence** — otherwise a long page that says
 * "calendar" thirty times in passing beats the page actually about calendars.
 */
export function search(q: string): KbArticle[] {
  return ranked(q).map((x) => x.a)
}

function ranked(q: string): { a: KbArticle; score: number }[] {
  const phrase = q.trim().toLowerCase()
  const terms = phrase.split(/\s+/).filter(Boolean)
  if (!terms.length) return articles().map((a) => ({ a, score: 0 }))

  return articles()
    .map((a) => {
      const title = a.title.toLowerCase()
      const slug = a.slug.toLowerCase()
      const summary = a.summary.toLowerCase()
      const body = a.body.toLowerCase()
      let score = 0
      if (terms.length > 1 && title.includes(phrase)) score += 25
      if (terms.length > 1 && body.includes(phrase)) score += 8
      for (const t of terms) {
        if (title.includes(t)) score += 10
        if (slug.includes(t)) score += 8
        if (summary.includes(t)) score += 4
        if (body.includes(t)) score += 1
      }
      return { a, score }
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || x.a.title.localeCompare(y.a.title))
}

/** One article by its id (the slug). */
export function article(id: string): KbArticle | null {
  const want = id.trim().toLowerCase()
  return articles().find((a) => a.slug.toLowerCase() === want) ?? null
}

export interface KbHit {
  id: string
  title: string
  url: string
  summary: string
  tags: string[]
  source: string
  score: number
  /** The text around the first match, so a reader can judge relevance
   *  without a second request for the whole article. */
  snippet: string
}

/**
 * Search results, without the full bodies.
 *
 * Seventeen articles' worth of body text in one response is most of a context
 * window spent on pages the assistant will not use. It gets a snippet to
 * judge by and fetches the one it wants — which is also what makes "answer
 * only from the KB" checkable: the article it quoted is the article it asked
 * for.
 */
export function searchHits(q: string): KbHit[] {
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return ranked(q).map(({ a, score }) => ({
    id: a.slug,
    title: a.title,
    url: a.url,
    summary: a.summary,
    tags: a.tags,
    source: a.source,
    score,
    snippet: snippetFor(a.body, terms),
  }))
}

function snippetFor(body: string, terms: string[]): string {
  const lower = body.toLowerCase()
  let at = -1
  for (const t of terms) {
    const i = lower.indexOf(t)
    if (i >= 0 && (at < 0 || i < at)) at = i
  }
  if (at < 0) return body.slice(0, 200).trim()
  const from = Math.max(0, at - 90)
  const to = Math.min(body.length, at + 150)
  return (from > 0 ? '…' : '') + body.slice(from, to).trim() + (to < body.length ? '…' : '')
}
