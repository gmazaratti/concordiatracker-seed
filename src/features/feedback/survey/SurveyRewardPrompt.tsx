import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useUiState } from '@/app/providers/ui-state'
import { useIsAdmin } from '@/features/admin/admin-data'
import { ModalShell } from '@/command/ModalShell'
import { Button } from '@/components/ui/Button'
import { REWARD_DAYS } from './survey-data'

const REQUIRED_DAYS = 3

/** A one-time centered pop-up that fires the first time a user becomes eligible
 * for the survey (≥3 distinct days of use) — inviting them in and leading with
 * the reward. Shows once (ui_state.surveyPromptSeen); after that the Feedback →
 * Quick survey tab (and its banner) carry it. */
export function SurveyRewardPrompt() {
  const { uiState, loaded, patchUiState } = useUiState()
  const { isAdmin } = useIsAdmin()
  const navigate = useNavigate()

  const daysUsed = uiState.visitDays?.length ?? 0
  const eligible = isAdmin || daysUsed >= REQUIRED_DAYS

  // Wait until the post-onboarding tour prompt has been dealt with, so the two
  // one-time pop-ups never stack.
  if (
    !loaded ||
    !eligible ||
    !uiState.tourPromptSeen ||
    uiState.surveyDone ||
    uiState.surveyDismissed ||
    uiState.surveyPromptSeen
  ) {
    return null
  }

  const dismiss = () => patchUiState({ surveyPromptSeen: true })

  return (
    <ModalShell label="A quick favour" onClose={dismiss}>
      <div className="p-6 text-center sm:p-7">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Sparkles size={26} aria-hidden />
        </span>
        <h2 className="mt-4 font-display text-[23px] leading-tight font-semibold text-fg">
          You&rsquo;ve been here a few days 👀
        </h2>
        <p className="mx-auto mt-2.5 max-w-sm text-[14.5px] leading-relaxed text-muted">
          Now that you&rsquo;ve actually used it, your take is gold. Take a two-minute survey and
          we&rsquo;ll add <span className="font-semibold text-accent">{REWARD_DAYS} days of Pro</span>{' '}
          to your account, free.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2.5">
          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => {
              dismiss()
              navigate('/app/requests?tab=survey')
            }}
          >
            Take the survey
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
