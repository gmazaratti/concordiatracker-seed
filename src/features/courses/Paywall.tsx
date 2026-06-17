import { ArrowRight, Lock, Sparkles } from 'lucide-react'
import { useSettings } from '@/app/providers/settings'
import { UpgradeChip } from '@/components/UpgradeChip'

/** Wraps a paid feature: when locked, the real UI shows blurred behind a lock +
 * Semester-pass CTA, so the value is visible but gated (the tangible paid line).
 * Flip the dev Free|Semester toggle to see both states. */
export function PaywallLock({
  locked,
  feature,
  children,
}: {
  locked: boolean
  feature: string
  children: React.ReactNode
}) {
  const { openSettings } = useSettings()
  if (!locked) return <>{children}</>
  return (
    <div className="relative overflow-hidden rounded-xl">
      <div
        aria-hidden
        className="pointer-events-none scale-[0.98] blur-[3px] select-none"
      >
        {children}
      </div>
      <div className="absolute inset-0 grid place-items-center bg-canvas/55 p-4 text-center backdrop-blur-[1px]">
        <div className="flex flex-col items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-accent/15 text-accent">
            <Lock size={16} aria-hidden />
          </span>
          <p className="text-[13px] font-medium text-fg">{feature} is a paid feature</p>
          <button
            type="button"
            onClick={() => openSettings('billing')}
            className="mt-0.5 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
          >
            Unlock with Semester pass
            <ArrowRight size={14} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}

/** Compact contextual teaser for the course-list rail — points free users at the
 * paid GPA predictor where its value is felt. Collapses to a slim one-line chip
 * on mobile so it stays discoverable without dominating the top of the page. */
export function PaywallCallout() {
  const { openSettings } = useSettings()
  return (
    <>
      <UpgradeChip
        icon={Sparkles}
        label="Predict your GPA"
        onClick={() => openSettings('billing')}
        className="sm:hidden"
      />
      <button
        type="button"
        onClick={() => openSettings('billing')}
        className="group hidden w-full items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft px-3.5 py-3 text-left transition-colors duration-150 hover:border-accent/50 sm:flex"
      >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
        <Sparkles size={18} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-fg">Predict your GPA</p>
        <p className="text-[12px] text-muted">
          See where grades land. <span className="text-accent">Semester pass</span>
        </p>
      </div>
      <ArrowRight
        size={16}
        className="shrink-0 text-accent transition-transform duration-150 group-hover:translate-x-0.5"
        aria-hidden
      />
      </button>
    </>
  )
}
