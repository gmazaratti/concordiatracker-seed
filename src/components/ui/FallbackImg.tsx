import { useEffect, useRef, useState } from 'react'

/**
 * An image that steps aside instead of leaving a broken box.
 *
 * The house rule everywhere an org picture appears is that a dead URL reveals
 * the branded fallback painted underneath it — never an empty frame. That was
 * written nine times as `onError={(e) => e.currentTarget.style.display='none'}`,
 * and an inline style set from an event handler is the one kind of state React
 * cannot take back: the node is reused across re-renders, so the element stays
 * hidden after the URL is replaced with a good one, and it stays hidden after a
 * failure that was only ever transient.
 *
 * That is the second half of the vanishing-image report. A fresh `src` must get
 * a fresh chance, and coming back to the tab must get one too — so the failure
 * is React state that records WHICH url failed, and returning to a hidden tab
 * clears it once to let the browser try again.
 *
 * It renders nothing at all when it has failed, which is what the callers
 * expect: they position it absolutely over the fallback they already drew.
 */
export function FallbackImg({
  src,
  alt = '',
  className,
  style,
  onFailed,
}: {
  src: string | null | undefined
  alt?: string
  className?: string
  style?: React.CSSProperties
  /** For a caller that wants to know as well as look right. */
  onFailed?: () => void
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = !!src && failedSrc === src
  // One retry per return to the tab, so a transient failure is not permanent
  // while a genuinely dead URL settles back to hidden on the next error.
  const retried = useRef<string | null>(null)

  useEffect(() => {
    if (!failed || !src) return
    const retry = () => {
      if (document.visibilityState !== 'visible' || retried.current === src) return
      retried.current = src
      setFailedSrc(null)
    }
    document.addEventListener('visibilitychange', retry)
    return () => document.removeEventListener('visibilitychange', retry)
  }, [failed, src])

  if (!src || failed) return null

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      referrerPolicy="no-referrer"
      onError={() => {
        setFailedSrc(src)
        onFailed?.()
      }}
    />
  )
}
