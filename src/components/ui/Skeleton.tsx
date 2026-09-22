import { cn } from '@/lib/cn'

/**
 * A placeholder in the shape of the thing that is coming.
 *
 * A spinner says "wait"; a skeleton says "wait, and here is roughly what for" —
 * which matters most exactly where we use it, on a section lookup that goes out
 * to Concordia and takes a couple of seconds. It also stops the layout jumping
 * when the real rows land, because the space is already the right size.
 *
 * The shimmer is a background-position sweep on a gradient, so it animates a
 * compositor-friendly property and costs nothing per row. Under reduced motion
 * the global duration-zero rule stops the sweep and the block simply sits
 * there, which is still a perfectly good placeholder.
 */
export function Skeleton({ className }: { className?: string }) {
  return <span className={cn('ct-shimmer block rounded', className)} aria-hidden />
}

/** Section rows: two lines and a right-hand seat count, the real row's shape. */
export function SectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul
      className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border"
      aria-hidden
    >
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-start gap-2 px-3 py-2.5">
          <span className="min-w-0 flex-1 space-y-1.5">
            {/* Varied widths, because a stack of identical bars reads as a
                pattern rather than as content arriving. */}
            <Skeleton className={cn('h-3', i % 2 === 0 ? 'w-32' : 'w-40')} />
            <Skeleton className={cn('h-2.5', i % 3 === 0 ? 'w-44' : 'w-36')} />
          </span>
          <Skeleton className="h-3 w-12 shrink-0" />
        </li>
      ))}
    </ul>
  )
}

/** Catalogue rows: a code, a title, and a line of description. */
export function CourseSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="space-y-2" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="rounded-xl border border-border bg-surface px-3.5 py-3">
          <div className="flex items-baseline gap-2">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className={cn('h-3', i % 2 === 0 ? 'w-48' : 'w-56')} />
          </div>
          <Skeleton className={cn('mt-2 h-2.5', i % 3 === 0 ? 'w-full' : 'w-3/4')} />
        </li>
      ))}
    </ul>
  )
}

/**
 * The feed, before it arrives.
 *
 * WHY THIS AND NOT "Loading…". The feed used to render its text the instant
 * the rows landed and then leave a grey square where each picture was going,
 * so the page assembled itself in two visible stages and moved under your
 * thumb between them. A skeleton in the real proportions means the layout is
 * final before anything is in it: what lands, lands in place.
 *
 * The shapes are deliberately the REAL ones — a 32px round avatar, a square
 * image, three action slots — because a placeholder that is the wrong size is
 * just a second layout shift with extra steps.
 */
export function StoriesRowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden px-1 py-3" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex w-[66px] shrink-0 flex-col items-center gap-1.5">
          <Skeleton className="size-[58px] rounded-full" />
          <Skeleton className={cn('h-2', i % 2 === 0 ? 'w-11' : 'w-8')} />
        </div>
      ))}
    </div>
  )
}

export function PostSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <article key={i} className="border-b border-border pb-3">
          <header className="flex items-center gap-2.5 py-2.5 sm:px-1">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className={cn('h-3', i % 2 === 0 ? 'w-28' : 'w-20')} />
          </header>
          {/* -mx-4 so it bleeds exactly as far as the real image does. */}
          <Skeleton className="-mx-4 aspect-square w-[calc(100%+2rem)] rounded-none sm:mx-0 sm:w-full sm:rounded-xl" />
          <div className="flex items-center gap-4 px-2 pt-3 sm:px-0">
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="size-5 rounded-full" />
            <span className="flex-1" />
            <Skeleton className="size-5 rounded" />
          </div>
          <Skeleton className="mt-2.5 h-2.5 w-3/4" />
        </article>
      ))}
    </div>
  )
}

/** A profile header: avatar, name, three counts, bio, buttons, tab strip. */
export function ProfileSkeleton() {
  return (
    <div aria-hidden>
      <div className="flex items-start gap-5 sm:gap-10">
        <Skeleton className="size-[86px] shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 pt-1">
          <Skeleton className="h-4 w-36" />
          <div className="mt-3.5 flex items-start sm:gap-9">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex-1 space-y-1.5 sm:flex-none">
                <Skeleton className="mx-auto h-4 w-7 sm:mx-0" />
                <Skeleton className="mx-auto h-2.5 w-14 sm:mx-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <Skeleton className="mt-4 h-3 w-24" />
      <Skeleton className="mt-2 h-2.5 w-full max-w-sm" />
      <div className="mt-4 flex items-center gap-2">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 flex-1 rounded-lg" />
      </div>
      <div className="mt-5 flex border-t border-border">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-1 justify-center py-3">
            <Skeleton className="size-5 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Conversation rows: face, a name, a line of preview. */
export function ThreadSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <span className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className={cn('h-3', i % 2 === 0 ? 'w-24' : 'w-32')} />
            <Skeleton className={cn('h-2.5', i % 3 === 0 ? 'w-40' : 'w-28')} />
          </span>
        </li>
      ))}
    </ul>
  )
}
