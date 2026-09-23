import { useCallback, useEffect, useRef, useState } from 'react'
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
 *
 * ── THE DISAPPEARING-IMAGE BUG, and why the `complete` check is load-bearing.
 *
 * This used to hold `shown` in state flipped only by `onLoad`, with everything
 * else at `opacity-0`. That loses a race it cannot win: when the bytes are
 * already in the browser's cache the element fires `load` DURING creation,
 * before React has attached a handler to it — so `onLoad` never arrives and a
 * perfectly good picture sits at zero opacity for the life of the component.
 * It was reported as "tab out and back and the images vanish", which is
 * exactly when it bites: leaving and returning remounts or re-decodes, the
 * second pass is a cache hit, and the cache hit is the case that breaks.
 *
 * So the element is ASKED whether it is loaded (`complete && naturalWidth`)
 * instead of being waited on, on attach and again when the tab comes back.
 * `onLoad` still runs for the genuinely-new case; it is no longer the only
 * way out of hidden.
 *
 * `shownSrc` rather than a boolean, for the same reason `OrgLogo` records
 * which URL failed: a new `src` must start hidden again on its own, with no
 * effect to reset it.
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
  const [shownSrc, setShownSrc] = useState<string | null>(known ? src : null)
  const shown = shownSrc === src
  const elRef = useRef<HTMLImageElement | null>(null)

  const settle = useCallback(() => {
    const el = elRef.current
    if (el && el.complete && el.naturalWidth > 0) {
      markWarm(src)
      setShownSrc(src)
      return true
    }
    return false
  }, [src])

  // Re-created per `src`, so React detaches and re-attaches on a change and
  // the freshly-pointed element gets asked the question too.
  const attach = useCallback(
    (el: HTMLImageElement | null) => {
      elRef.current = el
      if (el) settle()
    },
    [settle],
  )

  /* Coming back to the tab. A hidden document can skip a lazy load entirely
     and can have its decoded frames dropped; either way the element is the
     only thing that knows, so it is re-asked rather than re-fetched. */
  useEffect(() => {
    if (shown) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') settle()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [shown, settle])

  return (
    <img
      ref={attach}
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading={eager || known ? 'eager' : 'lazy'}
      decoding={known ? 'sync' : 'async'}
      onLoad={() => {
        markWarm(src)
        setShownSrc(src)
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
