import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Reveal } from './Reveal'

/**
 * One feature: a wide rounded panel, media on one side and a two-line headline
 * with a muted paragraph on the other. `flip` puts the media on the right, and
 * the page alternates it so four panels read as a sequence rather than a grid.
 *
 * The media column is wider than the text column (1.15fr) because the media is
 * the claim and the text is the caption for it. On a phone the media always
 * comes second, under the words that tell you what you are looking at.
 */
export function FeaturePanel({
  eyebrow,
  title,
  body,
  media,
  flip = false,
  index,
}: {
  eyebrow: string
  title: [string, string]
  body: string
  media: ReactNode
  flip?: boolean
  index: number
}) {
  return (
    <Reveal
      as="article"
      className="rounded-[28px] border border-border bg-surface/55 p-3 sm:p-4"
    >
      <div
        className={cn(
          'grid items-center gap-6 lg:gap-10',
          flip ? 'lg:grid-cols-[1.15fr_1fr]' : 'lg:grid-cols-[1fr_1.15fr]',
        )}
      >
        <div className={cn('px-3 pt-4 pb-1 sm:px-6 lg:py-10', flip ? 'lg:order-2' : 'lg:order-1')}>
          <p className="flex items-center gap-3 text-[12px] font-medium tracking-[0.18em] text-subtle uppercase">
            <span className="tabular-nums">{String(index).padStart(2, '0')}</span>
            <span className="h-px w-6 bg-border-strong" aria-hidden />
            {eyebrow}
          </p>
          <h2 className="mt-5 font-display text-[clamp(1.75rem,3.2vw,2.5rem)] leading-[1.06] font-bold tracking-[-0.025em] text-fg">
            {title[0]}
            <br />
            <span className="text-muted">{title[1]}</span>
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-pretty text-muted">{body}</p>
        </div>
        <div className={cn('min-w-0', flip ? 'lg:order-1' : 'lg:order-2')}>{media}</div>
      </div>
    </Reveal>
  )
}
