import { useState } from 'react'
import { Segmented } from '@/features/settings/controls'
import { SurveyPanel } from './SurveyPanel'
import { PublicSurveyForm } from '@/features/survey/PublicSurveyForm'
import { SurveyResult } from '@/features/survey/SurveyResult'
import type { PublicSurveyAnswers } from '@/features/survey/public-survey'

const VIEWS = [
  { value: 'product', label: 'About the app' },
  { value: 'habits', label: 'About your habits' },
]

/**
 * The in-app survey tab. Two genuinely different questionnaires:
 *
 *   • "About the app"   — product feedback, gated on a few days of real use,
 *                         and rewarded with 3 days of Pro.
 *   • "About your habits" — the same research questions as the public /survey,
 *                         about how you cope with deadlines generally.
 *
 * Product feedback leads, since that's what someone already inside the app is
 * best placed to give; /survey defaults to the other one for the opposite reason.
 */
export function SurveyTab() {
  const [view, setView] = useState('product')
  const [sent, setSent] = useState<PublicSurveyAnswers | null>(null)

  return (
    <div>
      <div className="mb-4 max-w-xs">
        <Segmented value={view} onChange={setView} options={VIEWS} ariaLabel="Which survey" />
      </div>

      {view === 'product' ? (
        <SurveyPanel />
      ) : sent ? (
        // Already has an account, so no signup CTA — just the personalised read.
        <SurveyResult answers={sent} showSignup={false} />
      ) : (
        <>
          <p className="mb-4 text-[13px] leading-relaxed text-muted">
            A few questions about how you handle deadlines in general — not about this app. It helps
            me understand what students actually struggle with.
          </p>
          <PublicSurveyForm compact onDone={setSent} />
        </>
      )}
    </div>
  )
}
