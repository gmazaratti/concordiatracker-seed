import { cn } from '@/lib/cn'

/**
 * A small cloud, with moods.
 *
 * NOT a port of jeremy-prt/bloub. That repo is MIT, but its own licence line
 * says the licence "covers the code in this repository, not the design it
 * imitates" — it is a study of the x.ai bot avatar, and shipping it as our
 * mascot would be adopting another company's face for a product that takes
 * payments. A soft shape with eyes is a category, not a design; this is ours.
 *
 * What bloub has that is worth having is a SET of states rather than one pose,
 * so the same character can carry a loading spinner, an empty inbox and a
 * finished import. That is what the moods below are.
 *
 * Built the way everything else here is: pure SVG, CSS keyframes only, no
 * animation library. The body is overlapping circles rather than one clever
 * path, because same-fill circles union with no visible seam and each one can
 * be nudged independently — which is what makes it read as soft rather than as
 * a logo. Colour comes from `currentColor`, so it inherits `text-accent` and
 * follows every theme including a custom one.
 *
 * THE RULE FOR USING IT: it marks moments when nothing is wrong. An empty
 * inbox, a caught-up week, a wait that is going fine. The moment something IS
 * wrong — a failing grade, a missed deadline, a payment problem, anything in
 * Radar or Money — it must be absent. A cartoon next to bad news reads as the
 * software not understanding what it just said. `sad` is for a search that
 * found nothing, never for news.
 */
export type MascotMood =
  /** Default. Breathes, blinks every six seconds. */
  | 'idle'
  /** Eyes closed, slower breath. Dormant rather than asleep. */
  | 'resting'
  /** Arced eyes and a gentle bob. Something went right. */
  | 'happy'
  /** Sways side to side, eyes drift. A wait that is going fine. */
  | 'thinking'
  /** Squashes and stretches on a loop. Actively processing. */
  | 'working'
  /** Wide eyes, a one-shot pop. Something appeared. */
  | 'surprised'
  /** Hops. Reserved for a genuine finish, not for every save. */
  | 'celebrate'
  /** Droops, eyes down. For "we found nothing", never for bad news. */
  | 'sad'

const SIZES = { xs: 28, sm: 44, md: 72, lg: 104, xl: 160 } as const

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
      <g className="ct-mascot-body">
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

        {/* Eyes are cut in the canvas colour rather than white, so the cloud
            reads as a hole in the page instead of a sticker on top of it. */}
        <g className="ct-mascot-eyes" fill="var(--ct-canvas)">
          <Eyes mood={mood} />
        </g>
      </g>
    </svg>
  )
}

/**
 * One shape per mood.
 *
 * Swapped rather than morphed. A path morph between an ellipse and an arc needs
 * matched node counts and buys nothing at 44 pixels — at this size the eye is
 * three or four pixels of ink, and what reads is the shape, not the transition
 * into it.
 */
function Eyes({ mood }: { mood: MascotMood }) {
  const arc = (x: number, up: boolean) => (
    <path
      d={up ? `M${x} 55c2.2-3.6 6.8-3.6 9 0` : `M${x} 52c2.2 3.6 6.8 3.6 9 0`}
      stroke="var(--ct-canvas)"
      strokeWidth="3.2"
      strokeLinecap="round"
      fill="none"
    />
  )

  switch (mood) {
    case 'happy':
    case 'celebrate':
      return (
        <>
          {arc(38.5, true)}
          {arc(54.5, true)}
        </>
      )
    case 'resting':
      return (
        <>
          <rect x="37.5" y="53" width="11" height="3.2" rx="1.6" />
          <rect x="53.5" y="53" width="11" height="3.2" rx="1.6" />
        </>
      )
    case 'sad':
      return (
        <>
          {arc(38.5, false)}
          {arc(54.5, false)}
        </>
      )
    case 'surprised':
      return (
        <>
          <ellipse cx="43" cy="54" rx="5.2" ry="6.2" />
          <ellipse cx="59" cy="54" rx="5.2" ry="6.2" />
        </>
      )
    default:
      return (
        <>
          <ellipse cx="43" cy="54" rx="3.8" ry="4.6" />
          <ellipse cx="59" cy="54" rx="3.8" ry="4.6" />
        </>
      )
  }
}

/**
 * The mascot with a line of text under it — the shape an empty state actually
 * needs, so a dozen screens do not each invent their own spacing.
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
