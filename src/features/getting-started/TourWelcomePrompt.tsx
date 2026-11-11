import { Clock, MousePointerClick, RotateCcw } from 'lucide-react'
import { useUiState } from '@/app/providers/ui-state'
import { useTour } from '@/features/tour/tour'
import { TOUR_STEPS } from '@/features/tour/steps'
import { ModalShell } from '@/command/ModalShell'
import { Button } from '@/components/ui/Button'
import { useOb } from '@/features/onboarding/flow/ob-i18n'

/** A one-time centered welcome shown after onboarding: the tour is genuinely
 * useful but the "Take a tour" button is easy to miss, so this invites people in
 * explicitly. Shows once (ui_state.tourPromptSeen), then never again. */
export function TourWelcomePrompt() {
  const { uiState, loaded, patchUiState } = useUiState()
  const { start } = useTour()
  const t = useOb()

  if (!loaded || uiState.tourPromptSeen) return null

  const dismiss = () => patchUiState({ tourPromptSeen: true })
  // Declining the invasive tour → point them at the passive Getting-started card
  // (the two complement each other: one walks you through, one just waits there).
  const maybeLater = () => {
    dismiss()
    window.dispatchEvent(new CustomEvent('ct:show-checklist'))
  }

  return (
    <ModalShell label={t('tour.title')} onClose={dismiss}>
      <div className="p-6 sm:p-7">
        <p className="text-[12px] font-semibold tracking-[0.16em] text-accent uppercase">{t('tour.eyebrow')}</p>
        <h2 className="mt-2 font-display text-[24px] leading-tight font-semibold text-fg">{t('tour.title')}</h2>
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted">
          {t('tour.body')}
        </p>
        <ul className="mt-4 space-y-2">
          {[
            [Clock, t('tour.p1')],
            [MousePointerClick, t('tour.p2')],
            [RotateCcw, t('tour.p3')],
          ].map(([Icon, text]) => {
            const I = Icon as typeof Clock
            return (
              <li key={text as string} className="flex items-center gap-2.5 text-[13.5px] text-fg">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                  <I size={14} aria-hidden />
                </span>
                {text as string}
              </li>
            )
          })}
        </ul>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            size="lg"
            className="flex-1"
            onClick={() => {
              dismiss()
              start(TOUR_STEPS)
            }}
          >
            {t('tour.start')}
          </Button>
          <button
            type="button"
            onClick={maybeLater}
            className="h-11 flex-1 rounded-xl border border-border px-4 text-[14px] font-medium text-muted transition-colors duration-150 hover:text-fg"
          >
            {t('tour.later')}
          </button>
        </div>
        <p className="mt-3 text-center text-[12px] text-subtle">
          {t('tour.foot')}
        </p>
      </div>
    </ModalShell>
  )
}
