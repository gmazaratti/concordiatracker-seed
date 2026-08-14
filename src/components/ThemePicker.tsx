import { Check } from 'lucide-react'
import { THEMES, useTheme } from '@/app/providers/theme'
import { cn } from '@/lib/cn'

/**
 * The Settings theme picker — a grid of miniature screens rather than a row of
 * swatches.
 *
 * Two dots stopped being enough once there were five themes: they tell you the
 * background and the accent, but not what a card, a heading, or a button will
 * actually look like on top of them. Each tile here renders the real tokens in
 * roughly the arrangement the app uses, so you can tell the two light themes
 * apart without applying them.
 *
 * The compact ThemeSwitcher is still used where space is tight (the avatar menu).
 */
export function ThemePicker() {
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
    >
      {THEMES.map((opt) => {
        const active = theme === opt.id
        const [canvas, accent] = opt.swatch
        const onLight = opt.scheme === 'light'
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            // The click point drives the circular reveal, so the new theme
            // sweeps out from the tile you actually pressed.
            onClick={(e) => setTheme(opt.id, { x: e.clientX, y: e.clientY })}
            className={cn(
              'group overflow-hidden rounded-xl border text-left transition-colors duration-150',
              active ? 'border-accent' : 'border-border hover:border-border-strong',
            )}
          >
            {/* Miniature of the app: canvas, a card, a heading line, a button. */}
            <span className="block px-2.5 pt-2.5 pb-2" style={{ backgroundColor: canvas }}>
              <span
                className="block rounded-md p-2"
                style={{
                  backgroundColor: opt.surface,
                  border: `1px solid ${onLight ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.07)'}`,
                }}
              >
                <span
                  className="block h-1.5 w-2/3 rounded-full"
                  style={{ backgroundColor: onLight ? 'rgba(0,0,0,.62)' : 'rgba(255,255,255,.72)' }}
                />
                <span
                  className="mt-1.5 block h-1.5 w-1/2 rounded-full"
                  style={{ backgroundColor: onLight ? 'rgba(0,0,0,.22)' : 'rgba(255,255,255,.24)' }}
                />
                <span
                  className="mt-2.5 block h-3 w-12 rounded"
                  style={{ backgroundColor: accent }}
                />
              </span>
            </span>

            <span className="flex items-center gap-1.5 border-t border-border bg-surface px-2.5 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-fg">
                {opt.label}
              </span>
              {active && <Check size={13} className="shrink-0 text-accent" aria-hidden />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
