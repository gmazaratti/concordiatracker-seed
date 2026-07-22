import { useState } from 'react'
import { GraduationCap, MoreHorizontal, Search, Users, type LucideIcon } from 'lucide-react'
import { useUiState } from '@/app/providers/ui-state'
import { HEARD_SOURCES } from './heard-about'
import { cn } from '@/lib/cn'

/* Brand glyphs as inline SVGs — lucide dropped its brand icons (trademark).
 * Rendered in currentColor (monochrome), same treatment as the community-profile
 * link icons — never the loud brand colors. */
function InstagramGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}
function TikTokGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  )
}
function RedditGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
  )
}
function PartyGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 21V4a1 1 0 0 1 1-1h11l-2 4 2 4H5" />
    </svg>
  )
}

type Glyph = LucideIcon | (({ size }: { size?: number }) => React.ReactNode)

/** id → glyph. Labels + order live in the shared data file (heard-about.ts). */
const GLYPHS: Record<string, Glyph> = {
  instagram: InstagramGlyph,
  tiktok: TikTokGlyph,
  reddit: RedditGlyph,
  friend: Users,
  teacher: GraduationCap,
  search: Search,
  club: PartyGlyph,
  other: MoreHorizontal,
}

/** Onboarding attribution — "how did you hear about ConcordiaTracker?" Optional
 * (Next advances regardless). The choice is stored on ui_state.heardFrom; picking
 * "Somewhere else" reveals a free-text field stored on ui_state.heardFromDetail. */
export function HeardAboutSlide() {
  const { uiState, loaded, patchUiState } = useUiState()
  const selected = uiState.heardFrom
  const [detail, setDetail] = useState(uiState.heardFromDetail ?? '')

  const onDetail = (v: string) => {
    setDetail(v)
    patchUiState({ heardFromDetail: v.trim() ? v.slice(0, 200) : undefined })
  }

  return (
    <div className="mx-auto w-full max-w-lg text-center">
      <h2 className="font-display text-[26px] leading-tight font-semibold text-fg sm:text-[30px]">
        How&rsquo;d you find us?
      </h2>
      <p className="mx-auto mt-2.5 max-w-md text-[14.5px] leading-relaxed text-muted">
        Totally optional — it just helps us know where to keep showing up for
        students like you.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {HEARD_SOURCES.map((s) => {
          const Glyph = GLYPHS[s.id] as LucideIcon
          const active = selected === s.id
          return (
            <button
              key={s.id}
              type="button"
              disabled={!loaded}
              aria-pressed={active}
              onClick={() => patchUiState({ heardFrom: active ? undefined : s.id })}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border p-3.5 text-[12.5px] font-medium transition-colors duration-150',
                active
                  ? 'border-accent bg-accent-soft text-fg'
                  : 'border-border bg-surface text-muted hover:border-border-strong hover:text-fg',
              )}
            >
              <span
                className={cn(
                  'grid size-9 place-items-center rounded-lg transition-colors duration-150',
                  active ? 'bg-accent text-accent-contrast' : 'bg-surface-2 text-muted',
                )}
              >
                <Glyph size={22} aria-hidden />
              </span>
              {s.label}
            </button>
          )
        })}
      </div>

      {/* "Somewhere else" → tell us where (so attribution isn't a dead end). */}
      {selected === 'other' && (
        <div className="mt-3 text-left">
          <label htmlFor="heard-other" className="mb-1.5 block text-[12.5px] font-medium text-fg">
            Where did you hear about us?
          </label>
          <input
            id="heard-other"
            type="text"
            value={detail}
            onChange={(e) => onDetail(e.target.value)}
            placeholder="e.g. a Discord server, a poster in the Hall building…"
            maxLength={200}
            autoFocus
            className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </div>
      )}
    </div>
  )
}
