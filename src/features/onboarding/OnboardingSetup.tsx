import { Check, Globe, Lock } from 'lucide-react'
import { THEMES, useTheme } from '@/app/providers/theme'
import { ProgramPicker, type ProgramSelection } from '@/components/ui/ProgramPicker'
import { useI18n, LANGS } from '@/i18n/i18n'
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

/** Setup steps 0–2: display name, handle, program (searchable picker). */
export function SetupStep({
  step,
  name,
  setName,
  handle,
  setHandle,
  profilePublic,
  setProfilePublic,
  program,
  setProgram,
  avatarUrl,
  handleStatus,
}: {
  step: number
  name: string
  setName: (v: string) => void
  handle: string
  setHandle: (v: string) => void
  profilePublic: boolean
  setProfilePublic: (v: boolean) => void
  program: ProgramSelection | null
  setProgram: (v: ProgramSelection) => void
  avatarUrl?: string
  handleStatus: 'idle' | 'free' | 'taken'
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

        <VisibilityChoice value={profilePublic} onChange={setProfilePublic} handle={handle} />
      </Centered>
    )
  }
  return (
    <Centered heading="What are you studying?" sub="Find your program — it personalizes the app (and Community relevance).">
      <div className="mt-1">
        <ProgramPicker value={program} onChange={setProgram} autoFocus size="lg" />
      </div>
    </Centered>
  )
}

/** The public/private choice for the user's profile page (concordiatracker.com/
 * @handle). Private is the default; the student chooses deliberately here. */
function VisibilityChoice({
  value,
  onChange,
  handle,
}: {
  value: boolean
  onChange: (v: boolean) => void
  handle: string
}) {
  return (
    <div className="mt-6 text-left">
      <p className="mb-2 text-center text-[12px] font-medium text-muted">Your profile page</p>
      <div className="grid grid-cols-2 gap-2.5">
        <VisibilityOption
          icon={Lock}
          label="Private"
          desc="Only your handle is visible to others."
          selected={!value}
          onClick={() => onChange(false)}
        />
        <VisibilityOption
          icon={Globe}
          label="Public"
          desc="Name, program, courses & blueprints visible."
          selected={value}
          onClick={() => onChange(true)}
        />
      </div>
      <p className="mt-2 text-center text-[11px] text-subtle">
        {value
          ? `Anyone can view concordiatracker.com/@${handle || 'you'}. Change it any time in Settings.`
          : 'You can make it public any time in Settings.'}
      </p>
    </div>
  )
}

function VisibilityOption({
  icon: Icon,
  label,
  desc,
  selected,
  onClick,
}: {
  icon: typeof Lock
  label: string
  desc: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors duration-150',
        selected ? 'border-accent bg-accent-soft' : 'border-border bg-surface hover:border-border-strong',
      )}
    >
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
        <Icon size={14} className={selected ? 'text-accent' : 'text-subtle'} aria-hidden />
        {label}
        {selected && <Check size={13} className="ml-auto text-accent" aria-hidden />}
      </span>
      <span className="text-[11px] leading-snug text-subtle">{desc}</span>
    </button>
  )
}

/** Setup step 3: pick a theme. Selecting applies it live (the whole onboarding
 * re-skins instantly) — the choice carries into the app. In-memory like the
 * rest of the seed, so it resets to the default on a hard reload. */
export function ThemeStep() {
  const { theme, setTheme } = useTheme()
  const { lang, setLang, t } = useI18n()
  return (
    <Centered
      heading="Make it yours"
      sub="Pick a look and a language — tap a theme and the whole app reskins instantly. Both are changeable any time in Settings."
    >
      {/* Language sits with appearance rather than getting its own step: it's a
          preference, not a decision worth interrupting signup for. English is
          the default; French is offered here so nobody has to go hunting. */}
      <div className="mt-1 mb-4 rounded-xl border border-border bg-surface p-3.5 text-left">
        <p className="mb-2 text-[13px] font-medium text-fg">{t('settings.language')}</p>
        <div className="grid grid-cols-2 gap-2">
          {LANGS.map((l) => {
            const active = l.id === lang
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setLang(l.id)}
                aria-pressed={active}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors duration-150',
                  active
                    ? 'border-accent bg-accent-soft text-fg'
                    : 'border-border text-muted hover:border-border-strong hover:text-fg',
                )}
              >
                {l.label}
                {active && <Check size={14} className="text-accent" aria-hidden />}
              </button>
            )
          })}
        </div>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-3">
        {THEMES.map((opt) => {
          const selected = opt.id === theme
          return (
            <button
              key={opt.id}
              type="button"
              onClick={(e) => setTheme(opt.id, { x: e.clientX, y: e.clientY })}
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
