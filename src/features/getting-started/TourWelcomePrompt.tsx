import { Compass } from 'lucide-react'
import { useUiState } from '@/app/providers/ui-state'
import { useTour } from '@/features/tour/tour'
import { TOUR_STEPS } from '@/features/tour/steps'
import { ModalShell } from '@/command/ModalShell'
import { Button } from '@/components/ui/Button'

/** A one-time centered welcome shown after onboarding: the tour is genuinely
 * useful but the "Take a tour" button is easy to miss, so this invites people in
 * explicitly. Shows once (ui_state.tourPromptSeen), then never again. */
export function TourWelcomePrompt() {
  const { uiState, loaded, patchUiState } = useUiState()
  const { start } = useTour()

  if (!loaded || uiState.tourPromptSeen) return null

  const dismiss = () => patchUiState({ tourPromptSeen: true })

  return (
    <ModalShell label="Welcome" onClose={dismiss}>
      <div className="p-6 text-center sm:p-7">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Compass size={26} aria-hidden />
        </span>
        <h2 className="mt-4 font-display text-[23px] leading-tight font-semibold text-fg">
          You&rsquo;re new here 👋
        </h2>
        <p className="mx-auto mt-2.5 max-w-sm text-[14.5px] leading-relaxed text-muted">
          Let me show you around — a quick, hands-on tour of everything you can do here. It takes
          about two minutes, and you can start it anytime from your profile menu.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2.5">
          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => {
              dismiss()
              start(TOUR_STEPS)
            }}
          >
            Show me around
          </Button>
          <button
            type="button"
            onClick={dismiss}
            className="text-[13px] font-medium text-subtle transition-colors hover:text-fg"
          >
            Maybe later
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
