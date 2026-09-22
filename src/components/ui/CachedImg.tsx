import { useState } from 'react'
import { isWarm, markWarm } from '@/lib/img-cache'
import { cn } from '@/lib/cn'

/**
 * An `<img>` that knows whether it has been seen before.
 *
 * One behaviour, and it is the whole point: a picture this session has already
 * decoded is painted at full opacity on the first frame, with `decoding="sync"`
 * so the browser is not allowed to hand back an empty box while it gets around
 * to it. Anything genuinely new fades in over 200ms instead of snapping.
 *
 * `onFailed` fires once, so a caller can swap in initials or a brand block
 * rather than leaving a broken frame. A failure is NOT remembered as warm.
 */
export function CachedImg({
  src,
  alt = '',
  className,
  style,
  onFailed,
  eager,
}: {
  src: string
  alt?: string
  className?: string
  /** For a size the caller computes at runtime — a chat avatar's px size is a
   *  prop, and there is no Tailwind class for an arbitrary number. */
  style?: React.CSSProperties
  onFailed?: () => void
  /** For something above the fold — an avatar, the first card in a feed. */
  eager?: boolean
}) {
  const known = isWarm(src)
  const [shown, setShown] = useState(known)

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading={eager || known ? 'eager' : 'lazy'}
      decoding={known ? 'sync' : 'async'}
      onLoad={() => {
        markWarm(src)
        if (!shown) setShown(true)
      }}
      onError={onFailed}
      style={style}
      className={cn(
        'transition-opacity duration-200',
        shown ? 'opacity-100' : 'opacity-0',
        className,
      )}
    />
  )
}
