import {
  CreditCard,
  Gauge,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useSettings, type SettingsSection } from '@/app/providers/settings'
import { useModalDismiss } from '@/app/hooks/useModalDismiss'
import { cn } from '@/lib/cn'
import { GeneralSection } from './sections/GeneralSection'
import { AccountSection } from './sections/AccountSection'
import { PrivacySection } from './sections/PrivacySection'
import { BillingSection } from './sections/BillingSection'
import { UsageSection } from './sections/UsageSection'

const SECTIONS: { id: SettingsSection; label: string; icon: LucideIcon }[] = [
  { id: 'general', label: 'General', icon: SlidersHorizontal },
  { id: 'account', label: 'Account', icon: UserRound },
  { id: 'privacy', label: 'Privacy', icon: ShieldCheck },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'usage', label: 'Usage', icon: Gauge },
]

const CONTENT: Record<SettingsSection, () => React.ReactNode> = {
  general: GeneralSection,
  account: AccountSection,
  privacy: PrivacySection,
  billing: BillingSection,
  usage: UsageSection,
}

/** The floating settings panel — Claude-desktop layout: a vertical section nav
 * on the left, scrollable content on the right. Focus-trapped, Escape to close,
 * scroll-locked, focus restored on close. Collapses to a full-screen sheet (nav
 * as a horizontal scroll row) on mobile. */
export function SettingsModal() {
  const { section, setSection, closeSettings } = useSettings()
  const { ref, onKeyDown } = useModalDismiss<HTMLDivElement>(closeSettings)
  const active = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]
  const Body = CONTENT[section]

  return (
    <div
      className="ct-animate-fade fixed inset-0 z-50 flex items-stretch justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={closeSettings}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="ct-animate-pop flex w-full flex-col overflow-hidden bg-surface shadow-2xl outline-none sm:h-[620px] sm:max-h-[88vh] sm:max-w-4xl sm:flex-row sm:rounded-2xl sm:border sm:border-border"
      >
        {/* Section nav — left rail on desktop, horizontal scroll row on mobile */}
        <div className="flex shrink-0 flex-col border-b border-border bg-surface-2/30 sm:w-56 sm:border-r sm:border-b-0">
          <div className="flex items-center justify-between px-4 pt-4 pb-1">
            <span className="font-display text-[15px] font-medium text-fg">Settings</span>
            <button
              type="button"
              onClick={closeSettings}
              aria-label="Close settings"
              className="rounded-md p-1 text-subtle transition-colors hover:bg-surface-2 hover:text-fg sm:hidden"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-2 pt-1 pb-2 sm:flex-col sm:overflow-visible sm:pb-3">
            {SECTIONS.map((s) => {
              const isActive = s.id === section
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setSection(s.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors duration-150 sm:w-full',
                    isActive
                      ? 'bg-accent-soft font-medium text-fg'
                      : 'text-muted hover:bg-surface-2 hover:text-fg',
                  )}
                >
                  <s.icon
                    size={16}
                    className={isActive ? 'text-accent' : 'text-subtle'}
                    aria-hidden
                  />
                  {s.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="hidden items-center justify-between border-b border-border px-6 py-4 sm:flex">
            <h2 className="font-display text-[17px] font-medium text-fg">{active.label}</h2>
            <button
              type="button"
              onClick={closeSettings}
              aria-label="Close settings"
              className="rounded-md p-1.5 text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <X size={18} aria-hidden />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <Body />
          </div>
        </div>
      </div>
    </div>
  )
}
