import {
  CalendarSync,
  Code2,
  CreditCard,
  Gauge,
  GraduationCap,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useSettings, type SettingsSection } from '@/app/providers/settings'
import { useModalDismiss } from '@/app/hooks/useModalDismiss'
import { useT } from '@/i18n/i18n'
import type { Key } from '@/i18n/en'
import { cn } from '@/lib/cn'
import { GeneralSection } from './sections/GeneralSection'
import { AccountSection } from './sections/AccountSection'
import { CalendarSyncSection } from './sections/CalendarSyncSection'
import { MoodleSection } from './sections/MoodleSection'
import { PrivacySection } from './sections/PrivacySection'
import { BillingSection } from './sections/BillingSection'
import { UsageSection } from './sections/UsageSection'
import { DeveloperSection } from './sections/DeveloperSection'
import { useIsAdmin } from '@/features/admin/admin-data'

/**
 * `adminOnly` is a display rule, and only a display rule.
 *
 * Hiding the tab does not protect anything and is not pretending to: minting
 * a token goes through `create_api_token`, which checks the caller itself,
 * and an owner-scope key is refused there whatever the screen shows. This is
 * about not putting a developer credential in front of a student who has no
 * use for one — clutter, not security.
 */
const SECTIONS: { id: SettingsSection; labelKey: Key; icon: LucideIcon; adminOnly?: boolean }[] = [
  { id: 'general', labelKey: 'settings.general', icon: SlidersHorizontal },
  { id: 'account', labelKey: 'settings.account', icon: UserRound },
  { id: 'calendarSync', labelKey: 'settings.calendarSync', icon: CalendarSync },
  { id: 'moodle', labelKey: 'settings.moodle', icon: GraduationCap },
  { id: 'privacy', labelKey: 'settings.privacy', icon: ShieldCheck },
  { id: 'billing', labelKey: 'settings.billing', icon: CreditCard },
  { id: 'usage', labelKey: 'settings.usage', icon: Gauge },
  { id: 'developer', labelKey: 'settings.developer', icon: Code2, adminOnly: true },
]

const CONTENT: Record<SettingsSection, () => React.ReactNode> = {
  general: GeneralSection,
  account: AccountSection,
  calendarSync: CalendarSyncSection,
  moodle: MoodleSection,
  privacy: PrivacySection,
  billing: BillingSection,
  usage: UsageSection,
  developer: DeveloperSection,
}

/** The floating settings panel — Claude-desktop layout: a vertical section nav
 * on the left, scrollable content on the right. Focus-trapped, Escape to close,
 * scroll-locked, focus restored on close. Collapses to a full-screen sheet (nav
 * as a horizontal scroll row) on mobile. */
export function SettingsModal() {
  const { section, setSection, closeSettings } = useSettings()
  const { ref, onKeyDown } = useModalDismiss<HTMLDivElement>(closeSettings)
  const t = useT()
  const { isAdmin } = useIsAdmin()
  const sections = SECTIONS.filter((s) => !s.adminOnly || isAdmin)
  // A deep link (or a stale `section`) must not land on a hidden tab, and it
  // must not render a blank panel either. Fall back to the first one.
  const visible = sections.some((s) => s.id === section) ? section : sections[0].id
  const active = sections.find((s) => s.id === visible) ?? sections[0]
  const Body = CONTENT[visible]

  return (
    /*
     * WHERE IT COMES FROM IS THE POINT.
     *
     * On a desktop this is opened from a gear in the bottom-left corner of the
     * sidebar, and it used to appear as an island in the middle of the screen
     * with a scale-up — the visual grammar of an interruption. Settings is not
     * an interruption; it is a place you asked to go. It now rises from that
     * corner: bottom-aligned, and clear of the sidebar's own 16rem, so the
     * panel reads as the sidebar unfolding rather than as something that
     * landed on top of the page.
     *
     * On a PHONE there is no sidebar and no corner, so it is the whole page,
     * arriving from the bottom edge like every other full-screen sheet here.
     * Same rise, one class, because the difference between an 18px lift on a
     * panel and on a page is not worth two.
     */
    <div
      className="ct-animate-fade fixed inset-0 z-50 flex items-stretch justify-center bg-black/45 sm:items-end sm:justify-start sm:p-3"
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
        className="ct-panel-up flex w-full flex-col overflow-hidden bg-surface outline-none sm:h-[min(620px,calc(100vh-1.5rem))] sm:max-w-4xl sm:flex-row sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl lg:ml-64"
      >
        {/* Section nav: left rail on desktop, horizontal scroll row on mobile */}
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
            {sections.map((s) => {
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
                  {t(s.labelKey)}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="hidden items-center justify-between border-b border-border px-6 py-4 sm:flex">
            <h2 className="font-display text-[17px] font-medium text-fg">{t(active.labelKey)}</h2>
            <button
              type="button"
              onClick={closeSettings}
              aria-label="Close settings"
              className="rounded-md p-1.5 text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <X size={18} aria-hidden />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-5 pb-[calc(1.25rem_+_env(safe-area-inset-bottom))] sm:px-6 sm:pb-5">
            <Body />
          </div>
        </div>
      </div>
    </div>
  )
}
