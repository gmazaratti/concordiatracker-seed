import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ExternalLink } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { LEGAL_DOCS, type Block, type LegalDoc, type ListItem } from './legal-content'

/** Highlights bracketed review placeholders ([AGE_MINIMUM — TBD], [VERIFY]…) so
 * unresolved items are impossible to miss in the draft. */
function withFlags(text: string) {
  return text.split(/(\[[^\]]+\])/g).map((part, i) =>
    /^\[[^\]]+\]$/.test(part) ? (
      <span
        key={i}
        className="rounded bg-warning/15 px-1 py-0.5 font-mono text-[0.85em] font-medium text-warning"
      >
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

/** The reading-column legal page (Terms / Privacy / Educator), matching the
 * reference structure — numbered sections, callouts — in the locked theme.
 * The doc is taken from an explicit prop (clean routes like `/terms`) or the
 * `:doc` route param (`/legal/:doc`). */
export function LegalPage({ doc: docProp }: { doc?: LegalDoc['slug'] }) {
  const params = useParams()
  const navigate = useNavigate()
  const slug = docProp ?? params.doc
  const data = slug ? LEGAL_DOCS[slug as LegalDoc['slug']] : undefined
  if (!data) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-canvas/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-3.5">
          <Link to="/" aria-label="ConcordiaTracker home">
            <Logo />
          </Link>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <ArrowLeft size={15} aria-hidden />
            Back
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:py-14">
        {/* Draft banner */}
        <div className="mb-8 flex gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3.5">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden />
          <div className="text-[13px] leading-relaxed text-muted">
            <p className="font-semibold text-fg">Draft — pending review</p>
            <p className="mt-0.5">
              This document is not finalized legal text. Bracketed items like{' '}
              <span className="rounded bg-warning/15 px-1 py-0.5 font-mono text-[0.85em] font-medium text-warning">
                [LIKE THIS]
              </span>{' '}
              are unresolved placeholders awaiting review.
            </p>
          </div>
        </div>

        <h1 className="font-display text-[clamp(1.9rem,4vw,2.6rem)] leading-tight font-medium text-fg">
          {data.title}
        </h1>
        <p className="mt-2 text-[13px] text-subtle">Last updated: {data.lastUpdated}</p>
        {data.intro && (
          <p className="mt-4 text-[15px] leading-relaxed text-muted">{data.intro}</p>
        )}

        <div className="mt-10 space-y-10">
          {data.sections.map((s) => (
            <section key={s.n} className="scroll-mt-20">
              <h2 className="text-[18px] font-semibold text-fg">
                <span className="text-subtle">{s.n}.</span> {s.title}
              </h2>
              <div className="mt-3 space-y-4">
                {s.blocks.map((b, i) => (
                  <BlockView key={i} block={b} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto w-full max-w-3xl px-5 py-6 text-[12px] text-subtle">
          <p>Not affiliated with Concordia University.</p>
          <p className="mt-1">
            Questions? <a href="mailto:concordiatracker@gmail.com" className="text-accent hover:underline">concordiatracker@gmail.com</a>
          </p>
        </div>
      </footer>
    </div>
  )
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'p':
      return <p className="text-[14px] leading-relaxed text-muted">{withFlags(block.text)}</p>
    case 'list':
      return (
        <ul className="space-y-2">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-muted">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-border-strong" aria-hidden />
              <span>{renderItem(it)}</span>
            </li>
          ))}
        </ul>
      )
    case 'callout':
      return (
        <div className="rounded-xl border border-border bg-surface px-4 py-3.5">
          {block.title && <p className="text-[13px] font-semibold text-fg">{block.title}</p>}
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{withFlags(block.text)}</p>
        </div>
      )
    case 'highlight':
      return (
        <p className="rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-[14px] leading-relaxed font-medium text-success">
          {block.text}
        </p>
      )
    case 'links':
      return (
        <ul className="space-y-2">
          {block.items.map((it, i) => (
            <li key={i} className="flex items-center gap-2 text-[14px]">
              <a
                href={it.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline"
              >
                {it.label}
                <ExternalLink size={13} className="text-subtle" aria-hidden />
              </a>
              {it.verify && (
                <span className="rounded bg-warning/15 px-1 py-0.5 font-mono text-[11px] font-medium text-warning">
                  [VERIFY]
                </span>
              )}
            </li>
          ))}
        </ul>
      )
  }
}

function renderItem(it: ListItem) {
  if (typeof it === 'string') return withFlags(it)
  return (
    <>
      <span className="font-medium text-fg">{it.label}:</span> {withFlags(it.text)}
    </>
  )
}
