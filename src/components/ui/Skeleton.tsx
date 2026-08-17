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
