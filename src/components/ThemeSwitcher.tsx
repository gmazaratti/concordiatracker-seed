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
            onClick={() => setTheme(opt.id)}
            className={cn(
              'flex flex-1 items-center rounded-md py-1.5 text-[12px] transition-colors duration-150',
              showLabels ? 'gap-2 px-2.5' : 'justify-center px-2',
              selected
                ? 'bg-surface-2 text-fg'
                : 'text-muted hover:text-fg',
            )}
          >
            <span
              className="size-3.5 shrink-0 rounded-full ring-1 ring-white/15"
              style={{
                background: `linear-gradient(135deg, ${opt.swatch[0]} 50%, ${opt.swatch[1]} 50%)`,
              }}
            />
            {showLabels && <span className="truncate">{opt.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
