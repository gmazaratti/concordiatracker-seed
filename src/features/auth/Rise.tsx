import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * One step of the sign-in screen's entrance: a wrapper that fades and lifts
 * its child in, `at` milliseconds after load (the `ct-auth-in` keyframes in
 * index.css). The resting style is visible, so if the animation never runs
 * the child is simply there.
 *
 * `on` is false once the entrance has played, which removes the class. That
 * matters because switching to the reset-password view and back remounts the
 * form, and replaying a 900ms stagger on a button press would read as the
 * screen hesitating.
 */
export function Rise({
  at,
  on,
  className,
  children,
}: {
  at: number
  on: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(on && 'ct-auth-in', className)}
      style={on ? ({ '--ct-in-delay': `${at}ms` } as CSSProperties) : undefined}
    >
      {children}
    </div>
  )
}
