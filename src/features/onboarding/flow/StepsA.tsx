import { AtSign, Check, Loader2, X } from 'lucide-react'
import { useI18n, LANGS, type Lang } from '@/i18n/i18n'
import { cn } from '@/lib/cn'
import { Stage, StepCopy } from './ObParts'
import { beam } from './ob-beam'
import { AvatarPicker } from './AvatarPicker'
import { useOb } from './ob-i18n'

/* ── Name (and language, since it is the first screen) ────────────────────── */

export function StepHello({
  name,
  setName,
  returning,
}: {
  name: string
  setName: (v: string) => void
  /** Redoing onboarding: the name is already theirs, so the ask is keep or change. */
  returning: boolean
}) {
  const t = useOb()
  const { lang, setLang } = useI18n()
  const first = name.trim().split(/\s+/)[0]
  const today = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())
  return (
    <>
      <StepCopy
        label={returning ? t('name.labelBack') : t('name.label')}
        title={
          <>
            {t('name.titleA')}
            <span className="text-accent">{t('name.titleB')}</span>
          </>
        }
        sub={returning ? t('name.subBack') : t('name.sub')}
      />
      <Stage>
        {/* Language first: everything after this screen is in the one they pick. */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-muted">{t('name.lang')}</span>
          <div className="flex rounded-xl bg-canvas p-1" role="group" aria-label={t('name.lang')}>
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                aria-pressed={lang === l.id}
                onClick={() => setLang(l.id as Lang)}
                className={cn(
                  'rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-200',
                  lang === l.id ? 'bg-accent text-accent-contrast' : 'text-muted hover:text-fg',
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="text-[13px] font-medium text-muted">{returning ? t('name.askBack') : t('name.ask')}</span>
          <span className={cn('mt-2 block rounded-2xl', beam(!first))}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('name.placeholder')}
              autoComplete="given-name"
              maxLength={60}
              className="w-full rounded-2xl border border-border bg-canvas px-4 py-3.5 text-[18px] font-medium text-fg outline-none transition-colors duration-200 placeholder:text-subtle focus:border-accent"
            />
          </span>
        </label>
        <div className="mt-4 rounded-2xl border border-border bg-canvas p-4">
          <p className="text-[12px] text-subtle first-letter:uppercase">{today}</p>
          <p className="mt-1 font-display text-[24px] leading-tight font-semibold text-fg">
            {t('name.greeting')}
            {first ? ',' : ''}{' '}
            <span key={first} className={cn('text-accent', first && 'ct-ob-pop inline-block')}>
              {first || '…'}
            </span>
          </p>
          <p className="mt-2 text-[13px] text-muted">{t('name.greetNote')}</p>
        </div>
      </Stage>
    </>
  )
}

/* ── Handle ───────────────────────────────────────────────────────────────── */

export type HandleState = 'empty' | 'short' | 'checking' | 'taken' | 'ok' | 'mine'

export function StepHandle({
  name,
  handle,
  setHandle,
  state,
}: {
  name: string
  handle: string
  setHandle: (v: string) => void
  /** From the real availability check; 'mine' = the handle they already own. */
  state: HandleState
}) {
  const t = useOb()
  const good = state === 'ok' || state === 'mine'
  return (
    <>
      <StepCopy label={t('handle.label')} title={t('handle.title')} sub={t('handle.sub')} note={t('handle.note')} />
      <Stage>
        <label className="block">
          <span className="text-[13px] font-medium text-muted">{state === 'mine' ? t('handle.keep') : t('handle.pick')}</span>
          <span className={cn('mt-2 block rounded-2xl', beam(!good))}>
            <span className="flex w-full items-center gap-1 rounded-2xl border border-border bg-canvas px-4 py-3.5 transition-colors duration-200 focus-within:border-accent">
              <AtSign size={18} className="shrink-0 text-subtle" aria-hidden />
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
                placeholder="yourname"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-label={t('handle.label')}
                className="min-w-0 flex-1 bg-transparent text-[18px] font-medium text-fg outline-none placeholder:text-subtle"
              />
              {state === 'checking' && <Loader2 size={16} className="shrink-0 animate-spin text-subtle" aria-hidden />}
              {good && (
                <span className="ct-ob-pop grid size-6 shrink-0 place-items-center rounded-full bg-success text-white">
                  <Check size={14} strokeWidth={3.5} aria-hidden />
                </span>
              )}
              {state === 'taken' && (
                <span className="ct-ob-pop grid size-6 shrink-0 place-items-center rounded-full bg-danger text-white">
                  <X size={14} strokeWidth={3.5} aria-hidden />
                </span>
              )}
            </span>
          </span>
        </label>
        <p className={cn('mt-2 min-h-[20px] text-[13px]', good ? 'text-success' : state === 'taken' ? 'text-danger' : 'text-subtle')} aria-live="polite">
          {state === 'ok' && t('handle.ok', { h: handle })}
          {state === 'mine' && t('handle.mine', { h: handle })}
          {state === 'taken' && t('handle.taken', { h: handle })}
          {state === 'short' && t('handle.short')}
          {state === 'checking' && t('handle.checking')}
          {state === 'empty' && t('handle.empty')}
        </p>

        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-canvas p-4">
          <AvatarPicker />
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-fg">{name.trim() || t('handle.yourName')}</span>
            <span key={handle} className={cn('block truncate text-[13px]', good ? 'ct-ob-pop text-accent' : 'text-subtle')}>
              concordiatracker.com/@{handle || '…'}
            </span>
            <span className="mt-0.5 block text-[12px] text-subtle">{t('handle.photo')}</span>
          </span>
        </div>
      </Stage>
    </>
  )
}
