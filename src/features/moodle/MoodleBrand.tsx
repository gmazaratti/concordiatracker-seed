import { useState } from 'react'
import { cn } from '@/lib/cn'

/** Moodle's orange, for the surfaces that stand in for a class colour. */
export const MOODLE_ORANGE = '#f98012'

/**
 * Moodle's square mark (public/moodle/logo.png). Falls back to a drawn "m" on
 * orange if the file is missing, so the tile is never a broken image.
 */
export function MoodleMark({ className }: { className?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span className={cn('grid place-items-center rounded-md font-bold text-white', className)} style={{ backgroundColor: MOODLE_ORANGE }} aria-hidden>
        m
      </span>
    )
  }
  return <img src="/moodle/logo.png" alt="" onError={() => setFailed(true)} className={cn('rounded-md object-cover', className)} />
}

/**
 * The wordmark on a white banner (public/moodle/banner.png), the way a class
 * card carries its colour. Falls back to a plain orange band with the name.
 */
export function MoodleBanner({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={cn('relative overflow-hidden', className)} style={{ backgroundColor: failed ? MOODLE_ORANGE : '#ffffff' }}>
      {failed ? (
        <span className="absolute inset-0 grid place-items-center font-display text-[22px] font-bold tracking-tight text-white" aria-hidden>
          moodle
        </span>
      ) : (
        <img src="/moodle/banner.png" alt="Moodle" onError={() => setFailed(true)} className="absolute inset-0 m-auto max-h-[62%] max-w-[70%] object-contain" />
      )}
      {children}
    </div>
  )
}
