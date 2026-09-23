import { useState } from 'react'
import { PlayCircle } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { TUTORIALS, type TutorialId, type Tutorial } from '@/lib/tutorials'
import { cn } from '@/lib/cn'

/**
 * "How this works" — a small, always-visible door to a walkthrough.
 *
 * A text trigger, not a bare (i): the question it answers is "show me", and
 * an icon on its own reads as fine print. `variant="icon"` exists for the one
 * place there is no room for words (beside a form field).
 */
export function TutorialHint({
  id,
  variant = 'pill',
  className,
}: {
  id: TutorialId
  variant?: 'pill' | 'icon' | 'dark'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const t: Tutorial = TUTORIALS[id]
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={variant === 'icon' ? `How it works: ${t.title}` : undefined}
        title={t.title}
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-full text-[12.5px] font-medium transition-colors duration-150',
          variant === 'icon'
            ? 'size-7 justify-center text-subtle hover:bg-surface-2 hover:text-fg'
            : variant === 'dark'
              ? 'bg-white/12 px-3 py-1.5 text-white/90 hover:bg-white/20'
              : 'border border-border px-3 py-1.5 text-muted hover:bg-surface-2 hover:text-fg',
          className,
        )}
      >
        <PlayCircle size={variant === 'icon' ? 16 : 14} aria-hidden />
        {variant !== 'icon' && 'How this works'}
      </button>
      {open && <TutorialDialog t={t} onClose={() => setOpen(false)} />}
    </>
  )
}

function TutorialDialog({ t, onClose }: { t: Tutorial; onClose: () => void }) {
  // Reduced motion: never autoplay; the controls appear so it can still be
  // started on purpose.
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <ModalShell label={t.title} onClose={onClose} widthClass="sm:max-w-md">
      <div className="px-5 pt-6 pb-5">
        {t.video ? (
          <video
            src={t.video}
            poster={t.poster}
            muted
            loop
            playsInline
            autoPlay={!reduced}
            controls={reduced}
            className="mb-4 w-full rounded-xl border border-border bg-black"
          />
        ) : null}
        <h2 className="text-[17px] font-semibold text-fg">{t.title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{t.lede}</p>
        <ol className="mt-4 space-y-2.5">
          {t.steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-[13.5px] leading-snug text-fg">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent">
                {i + 1}
              </span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </ModalShell>
  )
}
