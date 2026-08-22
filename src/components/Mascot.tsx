import { cn } from '@/lib/cn'

/**
 * A small cloud that lives in our empty states.
 *
 * NOT a port of jeremy-prt/bloub. That repo is MIT, but its own licence line
 * says the licence "covers the code in this repository, not the design it
 * imitates" — it is a study of the x.ai bot avatar, and shipping it as our
 * mascot would be adopting another company's face for a product that takes
 * payments. A soft blob with eyes is a category, not a design; this is ours.
 *
 * Built the way everything else here is built: pure SVG, CSS keyframes only, no
 * animation library. The body is overlapping circles rather than one clever
 * path, because same-fill circles union with no visible seam and each one can
 * be nudged independently — which is what makes it read as soft rather than as
 * a logo. The colour comes from `currentColor`, so it inherits `text-accent`
 * and follows every theme including a custom one.
 *
 * THE RULE FOR USING IT: it marks moments when nothing is wrong. An empty
 * inbox, a caught-up week, a wait that is going fine. The moment something IS
 * wrong — a failing grade, a missed deadline, a payment problem, anything in
 * Radar or Money — it must be absent. A cartoon next to bad news reads as the
 * software not understanding what it just said.
 */
export type MascotMood = 'idle' | 'thinking' | 'happy' | 'resting'

const SIZES = { sm: 44, md: 72, lg: 104 } as const

export function Mascot({
  mood = 'idle',
  size = 'md',
  className,
  label,
}: {
  mood?: MascotMood
  size?: keyof typeof SIZES
  className?: string
  /** Given only when the mascot carries meaning on its own. Inside a panel that
   *  already says "All caught up", it is decoration and stays unlabelled. */
  label?: string
}) {
  const px = SIZES[size]
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      fill="none"
      className={cn('ct-mascot', className)}
      data-mood={mood}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <g className="ct-mascot-body" style={{ transformOrigin: '51px 60px' }}>
        {/* Four bumps of descending size over a flat base. The asymmetry is the
            whole trick: three even bumps read as a lump, and a fourth small one
            stepping down on the right is what makes it a cloud. Same fill, so
            the overlaps union with no seam. */}
        <g fill="currentColor">
          <circle cx="27" cy="55" r="15" />
          <circle cx="46" cy="45" r="20" />
          <circle cx="66" cy="49" r="17" />
          <circle cx="79" cy="57" r="12" />
          <rect x="12" y="55" width="79" height="19" rx="9.5" />
        </g>

        {/* Eyes sit on the canvas colour rather than white, so the cloud reads as
            a cut-out of the page instead of a sticker on top of it. */}
        <g className="ct-mascot-eyes" fill="var(--ct-canvas)">
          {mood === 'happy' ? (
            <>
              <path
                d="M38.5 55c2.2-3.6 6.8-3.6 9 0"
                stroke="var(--ct-canvas)"
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M54.5 55c2.2-3.6 6.8-3.6 9 0"
                stroke="var(--ct-canvas)"
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="none"
              />
            </>
          ) : mood === 'resting' ? (
            <>
              <rect x="37.5" y="53" width="11" height="3.2" rx="1.6" />
              <rect x="53.5" y="53" width="11" height="3.2" rx="1.6" />
            </>
          ) : (
            <>
              <ellipse cx="43" cy="54" rx="3.8" ry="4.6" />
              <ellipse cx="59" cy="54" rx="3.8" ry="4.6" />
            </>
          )}
        </g>
      </g>
    </svg>
  )
}

/**
 * The mascot with a line of text under it — the shape an empty state actually
 * needs, so twelve screens do not each invent their own spacing.
 */
export function MascotEmpty({
  mood = 'resting',
  title,
  children,
  className,
}: {
  mood?: MascotMood
  title: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('px-6 py-10 text-center', className)}>
      <Mascot mood={mood} size="md" className="mx-auto text-accent/70" />
      <p className="mt-3 text-[15px] font-medium text-fg">{title}</p>
      {children && (
        <div className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-subtle">
          {children}
        </div>
      )}
    </div>
  )
}
