import { useSearchParams } from 'react-router-dom'
import { Bug, ClipboardList, Gift, Lightbulb, X } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useUiState } from '@/app/providers/ui-state'
import { useIsAdmin } from '@/features/admin/admin-data'
import { RequestsBoard } from './RequestsBoard'
import { BugChannel } from './BugChannel'
import { PinRequestsToast } from './PinRequestsToast'
import { SurveyTab } from './survey/SurveyTab'
import { cn } from '@/lib/cn'

const SURVEY_DAYS = 3

const TABS = [
  { id: 'requests', label: 'Feature requests', icon: Lightbulb },
  { id: 'bugs', label: 'Bug reports', icon: Bug },
  { id: 'survey', label: 'Quick survey', icon: ClipboardList },
] as const
type TabId = (typeof TABS)[number]['id']

/** `/app/requests` — the full feedback board rendered INSIDE the student app
 * shell, so the sidebar is always there (reached from the avatar menu and the
 * opt-in pinned item). The standalone /feedback page stays for signed-out /
 * shared links. */
export function AppRequestsPage() {
  const [params, setParams] = useSearchParams()
  const current = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'requests') as TabId
  const select = (id: TabId) =>
    setParams(
      (p) => {
        p.set('tab', id)
        return p
      },
      { replace: true },
    )

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-6">
      <header className="mb-4">
        <p className="text-[12px] text-subtle">Around the product</p>
        <h1 className="font-display text-[26px] leading-tight font-medium text-fg">Feedback</h1>
        <p className="mt-1 text-[13px] text-subtle">
          Vote on ideas and suggest what we build next — or report a bug privately.
        </p>
      </header>

      <div role="tablist" aria-label="Feedback channels" className="mb-5 flex gap-1 border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = t.id === current
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => select(t.id)}
              className={cn(
                'inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors duration-150',
                active ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
              )}
            >
              <Icon size={15} aria-hidden />
              {t.label}
            </button>
          )
        })}
      </div>

      {current !== 'survey' && <SurveyNudge onGo={() => select('survey')} />}
      {current === 'requests' ? <RequestsBoard /> : current === 'bugs' ? <BugChannel /> : <SurveyTab />}
      {current === 'requests' && <PinRequestsToast />}
    </div>
  )
}

/** A slim, dismissible banner that surfaces the survey once the user is eligible
 * (≥3 days of use) and hasn't done or dismissed it — the incentive is the reward
 * on the other side, so we lead with that. */
function SurveyNudge({ onGo }: { onGo: () => void }) {
  const { plan } = useAppData()
  const { uiState, loaded, patchUiState } = useUiState()
  const { isAdmin } = useIsAdmin()

  const daysUsed = uiState.visitDays?.length ?? 0
  const eligible = isAdmin || daysUsed >= SURVEY_DAYS
  if (!loaded || !eligible || uiState.surveyDone || uiState.surveyDismissed) return null

  return (
    <div className="mb-5 flex items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft/50 px-4 py-3">
      <Gift className="size-5 shrink-0 text-accent" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-fg">Got two minutes? Shape what we build next.</p>
        <p className="text-[12px] text-subtle">
          {plan === 'free'
            ? 'Recommend us at the end to unlock a referral code that discounts your semester pass.'
            : 'Recommend us at the end to unlock a referral code — credits stack toward next term.'}
        </p>
      </div>
      <button
        type="button"
        onClick={onGo}
        className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
      >
        Take the survey
      </button>
      <button
        type="button"
        onClick={() => patchUiState({ surveyDismissed: true })}
        aria-label="Dismiss"
        className="grid size-7 shrink-0 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <X size={15} aria-hidden />
      </button>
    </div>
  )
}
