import { useTheme } from '@/app/providers/theme'
import { THEMES } from '@/app/providers/theme'
import { cn } from '@/lib/cn'

/** Segmented swatch control. Themes swap purely from the tokens file. Set
 * `showLabels={false}` for a compact swatches-only form (e.g. the narrow avatar
 * menu, where long theme names overflow) — the name stays as the title/aria-label. */
export function ThemeSwitcher({
  className,
  showLabels = true,
}: {
  className?: string
  showLabels?: boolean
}) {
  const { theme, setTheme } = useTheme()
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        'flex gap-1 rounded-lg border border-border bg-canvas p-1',
        className,
      )}
    >
      {THEMES.map((opt) => {
        const selected = opt.id === theme
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={opt.label}
            title={opt.label}
            onClick={(e) => setTheme(opt.id, { x: e.clientX, y: e.clientY })}
            className={cn(
              'flex flex-1 items-center rounded-md py-1.5 text-[12px] transition-colors duration-150',
              showLabels ? 'gap-2 px-2.5' : 'justify-center px-2',
              selected
                ? 'bg-surface-2 text-fg'
                : 'text-muted hover:text-fg',
            )}
          >
            <span
              className={cn(
                'flex h-5 w-6 shrink-0 items-end gap-px overflow-hidden rounded-[5px] p-[3px] ring-1',
                selected ? 'ring-accent' : 'ring-border-strong',
              )}
              style={{ backgroundColor: opt.swatch[0] }}
              aria-hidden
            >
              {/* card, then accent: the same three tokens the Settings tiles
                  show, shrunk to something legible at 24px */}
              <span
                className="h-2 flex-1 rounded-[1.5px]"
                style={{ backgroundColor: opt.surface }}
              />
              <span
                className="h-3 w-1.5 rounded-[1.5px]"
                style={{ backgroundColor: opt.swatch[1] }}
              />
            </span>
            {showLabels && <span className="truncate">{opt.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
