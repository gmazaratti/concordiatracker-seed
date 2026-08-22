import { useEffect, useState } from 'react'
import { Eye, Lock, X } from 'lucide-react'
import { THEMES, useTheme } from '@/app/providers/theme'
import { useSettings } from '@/app/providers/settings'

/**
 * The bar that appears while a locked theme is being worn.
 *
 * A grid of miniature tiles can tell you a palette's background and accent. It
 * cannot tell you how the due list reads at 1am, or whether a course banner
 * still looks like yours. So a locked tile now puts the theme on the whole app
 * and closes settings, and this is what says so.
 *
 * Three things it must do: name the theme, show that it ends, and put the way
 * to keep it one tap away. It is bottom-centre and clears the mobile nav.
 */
export function ThemePreviewBar() {
  const { preview, endPreview } = useTheme()
  const { openSettings } = useSettings()

  if (!preview) return null
  const label =
    preview === 'custom' ? 'your colour' : (THEMES.find((t) => t.id === preview)?.label ?? preview)

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-5 print:hidden"
    >
      <div className="ct-animate-pop flex max-w-full items-center gap-2.5 rounded-full border border-border-strong bg-surface/95 py-1.5 pr-1.5 pl-3.5 shadow-lg backdrop-blur">
        <Eye size={14} className="shrink-0 text-accent" aria-hidden />
        <span className="truncate text-[12.5px] text-fg">
          Trying on <span className="font-medium">{label}</span>
          {/* Keyed on the theme, so switching previews restarts the clock from
              its own initial state rather than being reset inside an effect. */}
          <Countdown key={preview} />
        </span>
        <button
          type="button"
          onClick={() => openSettings('billing')}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
        >
          <Lock size={11} aria-hidden />
          Keep it
        </button>
        <button
          type="button"
          onClick={(e) => endPreview({ x: e.clientX, y: e.clientY })}
          aria-label="Exit preview"
          className="grid size-7 shrink-0 place-items-center rounded-full text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
    </div>
  )
}

/**
 * The honest part: a trial that visibly ends does not get mistaken for the
 * theme having quietly become free.
 */
function Countdown() {
  const [left, setLeft] = useState(120)

  useEffect(() => {
    const until = Date.now() + 120_000
    const id = window.setInterval(() => {
      setLeft(Math.max(0, Math.round((until - Date.now()) / 1000)))
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <span className="ml-1.5 text-subtle tabular-nums">
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
    </span>
  )
}
