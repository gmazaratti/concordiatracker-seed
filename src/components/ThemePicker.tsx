import { useState } from 'react'
import { Check, Lock, Palette } from 'lucide-react'
import { THEMES, useTheme, type Theme, type ThemeOption } from '@/app/providers/theme'
import { useAppData } from '@/app/providers/app-data'
import { useSettings } from '@/app/providers/settings'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Segmented } from '@/features/settings/controls'
import { accentTokens } from '@/lib/color'
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
 * Dark and Light are free. The rest of the palette, and a colour of your own,
 * come with the Semester pass — locked tiles are shown in full rather than
 * hidden, because you cannot want what you cannot see, and a greyed-out tile
 * with a padlock is a clearer offer than a list of feature names.
 *
 * The compact ThemeSwitcher covers the avatar menu, where space is tight.
 */
export function ThemePicker() {
  const { theme, setTheme, custom, setCustom } = useTheme()
  const { plan } = useAppData()
  const { openSettings } = useSettings()
  const pro = plan === 'semester'
  const [editing, setEditing] = useState(false)

  /** A locked tile sells rather than fails: it opens billing. */
  const pick = (id: Theme, locked: boolean, e: React.MouseEvent) => {
    if (locked) {
      openSettings('billing')
      return
    }
    if (id === 'custom') setEditing(true)
    // The click point drives the circular reveal, so the new theme sweeps out
    // from the tile you actually pressed.
    setTheme(id, { x: e.clientX, y: e.clientY })
  }

  const customTokens = accentTokens(custom.accent, custom.base)
  const customOption: ThemeOption = {
    id: 'custom',
    label: 'Your colour',
    swatch: [custom.base === 'dark' ? '#0f0f16' : '#f5f6f4', customTokens['--ct-accent']],
    surface: custom.base === 'dark' ? '#191926' : '#ffffff',
    scheme: custom.base,
    pro: true,
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {[...THEMES, customOption].map((opt) => {
          const locked = Boolean(opt.pro) && !pro
          return (
            <Tile
              key={opt.id}
              option={opt}
              active={theme === opt.id}
              locked={locked}
              onPick={(e) => pick(opt.id, locked, e)}
            />
          )
        })}
      </div>

      {!pro && (
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-subtle">
          Dark and Light are free, always. The rest of the palette and a colour of your own come
          with the Semester pass.
        </p>
      )}

      {/* The editor appears once "Your colour" is chosen, not before: an empty
          colour form above the grid is noise for everyone who wanted a preset. */}
      {pro && (theme === 'custom' || editing) && (
        <div className="mt-3 rounded-xl border border-border bg-canvas p-3">
          <p className="mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold text-fg">
            <Palette size={13} className="text-accent" aria-hidden />
            Your colour
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <label className="flex items-center gap-2 text-[12.5px] text-muted">
              Accent
              <ColorPicker
                value={custom.accent}
                onChange={(hex) => setCustom({ ...custom, accent: hex })}
                ariaLabel="Accent colour"
              />
            </label>

            <label className="flex items-center gap-2 text-[12.5px] text-muted">
              Base
              <Segmented
                value={custom.base}
                onChange={(v) => setCustom({ ...custom, base: v })}
                ariaLabel="Base palette"
                options={[
                  { value: 'dark', label: 'Dark' },
                  { value: 'light', label: 'Light' },
                ]}
              />
            </label>
          </div>

          <p className="mt-2.5 text-[11.5px] leading-relaxed text-subtle">
            Backgrounds and text stay as they are — those are where readability lives. If the
            colour you pick would disappear against the page, it is nudged until it does not.
          </p>
        </div>
      )}
    </div>
  )
}

/** One miniature of the app: canvas, a card, a heading line, a button. */
function Tile({
  option,
  active,
  locked,
  onPick,
}: {
  option: ThemeOption
  active: boolean
  locked: boolean
  onPick: (e: React.MouseEvent) => void
}) {
  const [canvas, accent] = option.swatch
  const onLight = option.scheme === 'light'
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={locked ? `${option.label} — included with the Semester pass` : option.label}
      onClick={onPick}
      className={cn(
        'group relative overflow-hidden rounded-xl border text-left transition-colors duration-150',
        active ? 'border-accent' : 'border-border hover:border-border-strong',
      )}
    >
      <span
        className={cn('block px-2.5 pt-2.5 pb-2', locked && 'opacity-45')}
        style={{ backgroundColor: canvas }}
      >
        <span
          className="block rounded-md p-2"
          style={{
            backgroundColor: option.surface,
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
          <span className="mt-2.5 block h-3 w-12 rounded" style={{ backgroundColor: accent }} />
        </span>
      </span>

      {locked && (
        <span
          className="pointer-events-none absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-canvas/85 text-subtle"
          aria-hidden
        >
          <Lock size={12} />
        </span>
      )}

      <span className="flex items-center gap-1.5 border-t border-border bg-surface px-2.5 py-1.5">
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-fg">
          {option.label}
        </span>
        {locked ? (
          <span className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
            Pro
          </span>
        ) : (
          active && <Check size={13} className="shrink-0 text-accent" aria-hidden />
        )}
      </span>
    </button>
  )
}
