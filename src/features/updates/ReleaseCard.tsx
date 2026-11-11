import { ArrowUpRight } from 'lucide-react'
import { PHOTOS } from '@/data/resource-photos'
import type { Release } from '@/data/releases'
import { cn } from '@/lib/cn'
import { artFor, releaseCounts, releaseDate, type ReleaseArt } from './release-art'

/**
 * The picture on a release card: a campus photo under the release's colour,
 * with the release's name set large and slanted across it, the way a poster
 * carries its own headline.
 */
export function ReleaseCover({
  release,
  art,
  size = 'md',
  className,
}: {
  release: Release
  art: ReleaseArt
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const Icon = art.icon
  const photo = PHOTOS[art.photo]
  return (
    <span
      className={cn('relative isolate block overflow-hidden rounded-2xl text-white', className)}
      style={{ backgroundColor: art.hex }}
    >
      <img
        src={photo.src}
        alt=""
        loading="lazy"
        className="absolute inset-0 -z-20 size-full object-cover opacity-75 mix-blend-luminosity grayscale transition-transform duration-500 group-hover:scale-[1.04]"
      />
      <span aria-hidden className="absolute inset-0 -z-10 mix-blend-multiply" style={{ backgroundColor: art.hex, opacity: 0.55 }} />
      <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />
      <Icon
        aria-hidden
        strokeWidth={1.4}
        className={cn(
          'absolute -right-3 -bottom-4 -z-10 rotate-[-10deg] text-white/20',
          size === 'lg' ? 'size-44' : size === 'md' ? 'size-32' : 'size-24',
        )}
      />
      <span className="absolute top-3 left-3 rounded-full bg-black/45 px-2.5 py-1 text-[11.5px] font-bold tabular-nums backdrop-blur-md">
        v{release.version}
      </span>
      <span
        aria-hidden
        className={cn(
          'absolute right-3 bottom-3 left-3 -skew-x-6 font-display leading-[0.95] font-extrabold tracking-tight text-balance uppercase italic drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]',
          size === 'lg' ? 'text-[30px] sm:text-[40px]' : size === 'md' ? 'text-[22px]' : 'line-clamp-3 text-[15px]',
        )}
      >
        {release.name}
      </span>
    </span>
  )
}

const shell =
  'group relative block w-full rounded-[28px] border border-border bg-surface p-2 text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none'

function Arrow() {
  return (
    <span
      aria-hidden
      className="absolute right-4 bottom-4 grid size-10 place-items-center rounded-full bg-fg text-canvas transition-transform duration-200 group-hover:rotate-45"
    >
      <ArrowUpRight size={17} strokeWidth={2.4} />
    </span>
  )
}

function Latest() {
  return (
    <span className="rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-bold tracking-[0.08em] text-accent-contrast uppercase">
      Latest
    </span>
  )
}

/** The picture on top, the words under it. `lead` is the large one. */
export function ReleaseCard({
  release,
  index,
  lead,
  onOpen,
}: {
  release: Release
  index: number
  lead?: boolean
  onOpen: () => void
}) {
  const art = artFor(release, index)
  return (
    <button type="button" onClick={onOpen} className={cn(shell, 'ct-res-in flex h-full flex-col', index === 0 && 'ct-ring')} style={{ animationDelay: `${Math.min(index, 9) * 40}ms` }}>
      <ReleaseCover release={release} art={art} size={lead ? 'lg' : 'md'} className={lead ? 'aspect-[16/8] sm:aspect-[16/7]' : 'aspect-[16/9]'} />
      <span className="flex flex-1 flex-col px-4 pt-4 pb-3 pr-16">
        <span className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
          {releaseDate(release.date)}
          {index === 0 && <Latest />}
        </span>
        <span className={cn('mt-1.5 block font-display leading-snug font-semibold text-balance text-fg', lead ? 'text-[22px] sm:text-[24px]' : 'text-[17px]')}>
          {release.name}
        </span>
        {lead && (
          <span className="mt-1.5 line-clamp-2 block text-[13.5px] leading-relaxed text-muted">{release.changes[0]?.text}</span>
        )}
        <span className="mt-2 block text-[12px] text-subtle tabular-nums">{releaseCounts(release)}</span>
      </span>
      <Arrow />
    </button>
  )
}

/** The picture on the left, the words on the right: the two beside the lead. */
export function ReleaseRow({ release, index, onOpen }: { release: Release; index: number; onOpen: () => void }) {
  const art = artFor(release, index)
  return (
    <button type="button" onClick={onOpen} className={cn(shell, 'ct-res-in flex h-full items-stretch gap-1')} style={{ animationDelay: `${index * 40}ms` }}>
      <ReleaseCover release={release} art={art} size="sm" className="min-h-[132px] w-[38%] shrink-0 sm:min-h-[150px]" />
      <span className="flex min-w-0 flex-1 flex-col py-3 pr-14 pl-3">
        <span className="text-[12.5px] text-muted">{releaseDate(release.date)}</span>
        <span className="mt-1.5 block font-display text-[17px] leading-snug font-semibold text-balance text-fg">{release.name}</span>
        <span className="mt-auto block pt-2 text-[12px] text-subtle tabular-nums">{releaseCounts(release)}</span>
      </span>
      <Arrow />
    </button>
  )
}
