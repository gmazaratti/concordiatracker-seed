import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ClipboardList, Gift, type LucideIcon } from 'lucide-react'
import { useUiState } from '@/app/providers/ui-state'
import { SurveyPanel } from './SurveyPanel'
import { PublicSurveyForm } from '@/features/survey/PublicSurveyForm'
import { SurveyResult } from '@/features/survey/SurveyResult'
import type { PublicSurveyAnswers } from '@/features/survey/public-survey'

type Open = null | 'product' | 'habits'

/**
 * The in-app survey tab: a LIST of available surveys rather than a two-way
 * switch, so adding a third later is one array entry instead of a redesign.
 * Picking one opens it in place, with a way back.
 */
export function SurveyTab() {
  const [open, setOpen] = useState<Open>(null)
  const [sentHabits, setSentHabits] = useState<PublicSurveyAnswers | null>(null)
  const { uiState } = useUiState()

  if (open === 'product') {
    return (
      <div>
        <BackLink onClick={() => setOpen(null)} />
        <SurveyPanel />
      </div>
    )
  }

  if (open === 'habits') {
    return (
      <div>
        <BackLink onClick={() => setOpen(null)} />
        {sentHabits ? (
          // They already have an account, so no signup CTA — just the read-back.
          <SurveyResult answers={sentHabits} showSignup={false} />
        ) : (
          <>
            <p className="mb-4 text-[13px] leading-relaxed text-muted">
              A few questions about how you handle deadlines in general — not about this app. It
              helps me understand what students actually struggle with.
            </p>
            <PublicSurveyForm compact onDone={setSentHabits} />
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <SurveyCard
        icon={Gift}
        title="About the app"
        description="How ConcordiaTracker is working for you — what's good, what's broken, what's missing."
        meta="~2 min · 3 days of Pro when you finish"
        done={!!uiState.surveyDone}
        onOpen={() => setOpen('product')}
      />
      <SurveyCard
        icon={ClipboardList}
        title="About your habits"
        description="How you keep track of deadlines and grades in general — nothing to do with this app."
        meta="~2 min"
        done={!!sentHabits}
        onOpen={() => setOpen('habits')}
      />
    </div>
  )
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-fg"
    >
      <ArrowLeft size={15} aria-hidden />
      All surveys
    </button>
  )
}

function SurveyCard({
  icon: Icon,
  title,
  description,
  meta,
  done,
  onOpen,
}: {
  icon: LucideIcon
  title: string
  description: string
  meta: string
  done: boolean
  onOpen: () => void
}) {
  return (
    <section className="flex items-start gap-3.5 rounded-xl border border-border bg-surface p-4">
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
        <Icon size={17} aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-[14.5px] font-semibold text-fg">{title}</h3>
          {done && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-success">
              <Check size={10} strokeWidth={3} aria-hidden />
              Done
            </span>
          )}
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>
        <p className="mt-1.5 text-[11.5px] text-subtle">{meta}</p>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 self-center rounded-lg bg-accent px-3 py-2 text-[12.5px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
      >
        {done ? 'View' : 'Start'}
        <ArrowRight size={14} aria-hidden />
      </button>
    </section>
  )
}
