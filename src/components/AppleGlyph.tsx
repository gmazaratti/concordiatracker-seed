import type { SVGProps } from 'react'

/**
 * The Apple mark.
 *
 * `currentColor`, not black: Apple's guidelines allow a white or black mark
 * depending on the button, and this button is themed — a hard-coded black
 * logo disappears on the dark surface it sits on.
 */
export function AppleGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M17.05 12.94c-.03-2.64 2.16-3.91 2.26-3.97-1.23-1.8-3.15-2.05-3.83-2.08-1.63-.16-3.18.96-4.01.96-.82 0-2.1-.94-3.45-.91-1.78.03-3.42 1.03-4.33 2.62-1.84 3.2-.47 7.94 1.32 10.54.88 1.27 1.93 2.7 3.31 2.65 1.33-.05 1.83-.86 3.44-.86 1.6 0 2.06.86 3.46.83 1.43-.02 2.34-1.3 3.21-2.58 1.01-1.48 1.43-2.91 1.45-2.99-.03-.01-2.78-1.07-2.81-4.24zM14.5 5.2c.73-.88 1.22-2.11 1.09-3.33-1.05.04-2.32.7-3.07 1.58-.67.78-1.26 2.02-1.1 3.22 1.17.09 2.36-.6 3.08-1.47z" />
    </svg>
  )
}
