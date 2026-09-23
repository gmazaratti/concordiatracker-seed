/**
 * Repost, drawn to the same height as the icons beside it.
 *
 * WHY NOT `Repeat2`. Every icon in the action row is rendered at 19px, but a
 * box is not ink: lucide's repeat mark occupies y=6..18 of its 24-unit box
 * while the heart, the speech bubble and the bookmark all run about y=3..21.
 * At the same nominal size it therefore draws two thirds the height of its
 * neighbours and reads as a smaller button on a row that is meant to be even.
 *
 * Same geometry as theirs — 24 viewBox, 2px stroke, round caps and joins — so
 * it sits in the row as one of them rather than as an import from somewhere
 * else. Only the extents changed.
 */
export function RepostGlyph({ size = 19, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m17 2.5 4 4-4 4" />
      <path d="M21 6.5H8a4 4 0 0 0-4 4v3" />
      <path d="m7 21.5-4-4 4-4" />
      <path d="M3 17.5h13a4 4 0 0 0 4-4v-3" />
    </svg>
  )
}
