import { Check } from 'lucide-react'
import { THEMES, useTheme } from '@/app/providers/theme'
import { cn } from '@/lib/cn'
import { HANDLE_RE } from './handle'

const field =
  'mt-5 w-full rounded-xl border border-border bg-surface px-4 py-3 text-center text-[18px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

export function Centered({ heading, sub, children }: { heading: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col text-center">
      <h2 className="font-display text-[21px] leading-tight font-semibold text-fg sm:text-[28px]">{heading}</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted sm:text-[14px]">{sub}</p>
      <div className="mt-2 space-y-4">{children}</div>
    </div>
  )
}

/** Setup steps 0–2: display name, handle, major (text fields). */
export function SetupStep({
  step,
  name,
  setName,
  handle,
  setHandle,
  major,
  setMajor,
  avatarUrl,
  handleStatus,
  onEnter,
}: {
  step: number
  name: string
  setName: (v: string) => void
  handle: string
  setHandle: (v: string) => void
  major: string
  setMajor: (v: string) => void
  avatarUrl?: string
  handleStatus: 'idle' | 'free' | 'taken'
  onEnter: () => void
}) {
  if (step === 0) {
    return (
      <Centered heading="Welcome — what should we call you?" sub="This is your display name. You can change it any time in Settings.">
        {avatarUrl && (
          <img src={avatarUrl} alt="" referrerPolicy="no-referrer" className="mx-auto size-14 rounded-full bg-surface-2 object-cover" />
        )}
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={60} className={field} />
      </Centered>
    )
  }
  if (step === 1) {
    const valid = HANDLE_RE.test(handle)
    return (
      <Centered heading="Claim your handle" sub="How you'll show up on feedback posts. 3–20 lowercase letters, numbers, or underscores.">
        <div className="mt-5 flex items-center rounded-xl border border-border bg-surface px-4 py-3 focus-within:border-accent">
          <span className="text-[18px] text-subtle">@</span>
          <input
            autoFocus
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
            placeholder="handle"
            className="ml-0.5 w-full bg-transparent text-[18px] text-fg placeholder:text-subtle focus:outline-none"
          />
        </div>
        {handle.length > 0 && !valid && <p className="mt-2 text-[12px] text-warning">A little longer — at least 3 characters.</p>}
        {valid && handleStatus === 'taken' && <p className="mt-2 text-[12px] text-danger">@{handle} is taken — try another.</p>}
        {valid && handleStatus === 'free' && <p className="mt-2 text-[12px] text-success">@{handle} is available.</p>}
      </Centered>
    )
  }
  return (
    <Centered heading="What are you studying?" sub="Your major personalizes the app (and Community relevance).">
      <input
        autoFocus
        value={major}
        onChange={(e) => setMajor(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter()}
        placeholder="e.g. Computer Science"
        maxLength={80}
        className={field}
      />
    </Centered>
  )
}

/** Setup step 3: pick a theme. Selecting applies it live (the whole onboarding
 * re-skins instantly) — the choice carries into the app. In-memory like the
 * rest of the seed, so it resets to the default on a hard reload. */
export function ThemeStep() {
  const { theme, setTheme } = useTheme()
  return (
    <Centered heading="Pick your look" sub="Choose a theme — tap one and the whole app reskins instantly. You can change it any time in Settings.">
      <div className="mt-1 grid grid-cols-2 gap-3">
        {THEMES.map((opt) => {
          const selected = opt.id === theme
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id)}
              aria-pressed={selected}
              className={cn(
                'flex items-center gap-3 rounded-xl border p-3 text-left transition-colors duration-150',
                selected ? 'border-accent bg-accent-soft' : 'border-border bg-surface hover:border-border-strong',
              )}
            >
              <span
                className="size-9 shrink-0 rounded-lg ring-1 ring-white/10"
                style={{ background: `linear-gradient(135deg, ${opt.swatch[0]} 50%, ${opt.swatch[1]} 50%)` }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">{opt.label}</span>
              {selected && <Check size={16} className="shrink-0 text-accent" aria-hidden />}
            </button>
          )
        })}
      </div>
    </Centered>
  )
}
