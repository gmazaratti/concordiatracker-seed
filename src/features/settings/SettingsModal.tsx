import { useEffect, useRef } from 'react'
import {
  CalendarSync,
  Code2,
  CreditCard,
  Gauge,
  MonitorSmartphone,
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
import { DevicesSection } from './sections/DevicesSection'
import { useIsAdmin } from '@/features/admin/admin-data'
import { useAppData } from '@/app/providers/app-data'
import { PURCHASES_HIDDEN } from '@/lib/store-policy'

/**
 * `adminOnly` is a display rule, and only a display rule.
 *
 * Hiding the tab does not protect anything and is not pretending to: minting
 * a token goes through `create_api_token`, which checks the caller itself,
 * and an owner-scope key is refused there whatever the screen shows. This is
 * about not putting a developer credential in front of a student who has no
 * use for one — clutter, not security.
 */
/**
 * 

[38;5;69m ██████╗  ████████╗   ██████╗   ██████╗   ███████╗         ██████╗  ██╗       [0m
[38;5;69m██╗  [0m
[38;5;69m██╔════╝  ╚══██╔══╝  ██╔═══██╗  ██╔══██╗  ██╔════╝        ██╔════╝  ██║       [0m
[38;5;69m██║  [0m
[38;5;189m╚█████╗      ██║     ██║   ██║  ██████╔╝  █████╗          ██║       ██║       [0m
[38;5;189m██║  [0m
[38;5;153m ╚═══██╗     ██║     ██║   ██║  ██╔══██╗  ██╔══╝          ██║       ██║       [0m
[38;5;153m██║  [0m
[38;5;153m██████╔╝     ██║     ╚██████╔╝  ██║  ██║  ███████╗        ╚██████╗  ███████╗  [0m
[38;5;153m██║  [0m
[38;5;75m╚═════╝      ╚═╝      ╚═════╝   ╚═╝  ╚═╝  ╚══════╝         ╚═════╝  ╚══════╝  [0m
[38;5;75m╚═╝  [0m

[38;5;8mv22608.1401.4.0 - Preview[0m

Usage: [38;5;69mstore[0m [38;5;189m<command>[0m [38;5;8m[options][0m
       [38;5;69mstore[0m [38;5;51m--help[0m

Use '[38;5;69mstore[0m [38;5;189m<command>[0m [38;5;51m--help[0m' to get detailed help for any command.

[38;5;69mDiscovery Commands:[0m
[38;5;238m┌──────────────┬──────────────────────────────────────────┐[0m
[38;5;238m│[0m [38;5;189mcommand[0m      [38;5;238m│[0m [38;5;189mdescription[0m                              [38;5;238m│[0m
[38;5;238m├──────────────┼──────────────────────────────────────────┤[0m
[38;5;238m│[0m addons       [38;5;238m│[0m List add-ons for a game                  [38;5;238m│[0m
[38;5;238m│[0m browse-apps  [38;5;238m│[0m Browse ranked app lists                  [38;5;238m│[0m
[38;5;238m│[0m browse-games [38;5;238m│[0m Browse ranked game lists                 [38;5;238m│[0m
[38;5;238m│[0m extension    [38;5;238m│[0m Find apps that open specific file types  [38;5;238m│[0m
[38;5;238m│[0m protocol     [38;5;238m│[0m Find apps that handle custom URL schemes [38;5;238m│[0m
[38;5;238m│[0m publisher    [38;5;238m│[0m Find products from a publisher           [38;5;238m│[0m
[38;5;238m│[0m search       [38;5;238m│[0m Search for apps and games                [38;5;238m│[0m
[38;5;238m│[0m show         [38;5;238m│[0m Show product details and ratings         [38;5;238m│[0m
[38;5;238m│[0m similar      [38;5;238m│[0m Find similar products                    [38;5;238m│[0m
[38;5;238m└──────────────┴──────────────────────────────────────────┘[0m

[38;5;69mOperations Commands:[0m
[38;5;238m┌───────────┬─────────────────────────────────────────────┐[0m
[38;5;238m│[0m [38;5;189mcommand[0m   [38;5;238m│[0m [38;5;189mdescription[0m                                 [38;5;238m│[0m
[38;5;238m├───────────┼─────────────────────────────────────────────┤[0m
[38;5;238m│[0m install   [38;5;238m│[0m Install an app from the Store               [38;5;238m│[0m
[38;5;238m│[0m installed [38;5;238m│[0m List all installed apps                     [38;5;238m│[0m
[38;5;238m│[0m update    [38;5;238m│[0m Check updates for a specific app            [38;5;238m│[0m
[38;5;238m│[0m updates   [38;5;238m│[0m Check for updates across all installed apps [38;5;238m│[0m
[38;5;238m└───────────┴─────────────────────────────────────────────┘[0m

[38;5;69mHelper Commands:[0m
[38;5;238m┌─────────────────┬─────────────────────────────────┐[0m
[38;5;238m│[0m [38;5;189mcommand[0m         [38;5;238m│[0m [38;5;189mdescription[0m                     [38;5;238m│[0m
[38;5;238m├─────────────────┼─────────────────────────────────┤[0m
[38;5;238m│[0m app-categories  [38;5;238m│[0m List app categories             [38;5;238m│[0m
[38;5;238m│[0m game-categories [38;5;238m│[0m List game categories            [38;5;238m│[0m
[38;5;238m│[0m muid            [38;5;238m│[0m Get the Store device identifier [38;5;238m│[0m
[38;5;238m└─────────────────┴─────────────────────────────────┘[0m

[38;5;69mExamples:[0m
  [38;5;8mstore search "Microsoft Teams"[0m
  [38;5;8mstore show "Visual Studio Code"[0m
  [38;5;8mstore browse-apps top-free --category productivity[0m
  [38;5;8mstore browse-games top-paid --only-game-pass[0m
  [38;5;8mstore similar firefox[0m
  [38;5;8mstore updates[0m
  [38;5;8mstore install whatsapp[0m: how the tab behaves in the App Store build (lib/store-policy).
 * 'never' = it is about buying, so it is not there at all; 'pro' = a Pro
 * feature, shown only to an account that already has it.
 */
const SECTIONS: {
  id: SettingsSection
  labelKey: Key
  icon: LucideIcon
  adminOnly?: boolean
  store?: 'never' | 'pro'
}[] = [
  { id: 'general', labelKey: 'settings.general', icon: SlidersHorizontal },
  { id: 'account', labelKey: 'settings.account', icon: UserRound },
  { id: 'calendarSync', labelKey: 'settings.calendarSync', icon: CalendarSync, store: 'pro' },
  { id: 'moodle', labelKey: 'settings.moodle', icon: GraduationCap },
  { id: 'privacy', labelKey: 'settings.privacy', icon: ShieldCheck },
  { id: 'devices', labelKey: 'settings.devices', icon: MonitorSmartphone },
  { id: 'billing', labelKey: 'settings.billing', icon: CreditCard, store: 'never' },
  { id: 'usage', labelKey: 'settings.usage', icon: Gauge, store: 'never' },
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
  devices: DevicesSection,
  developer: DeveloperSection,
}

/** The floating settings panel — Claude-desktop layout: a vertical section nav
 * on the left, scrollable content on the right. Focus-trapped, Escape to close,
 * scroll-locked, focus restored on close. Collapses to a full-screen sheet (nav
 * as a horizontal scroll row) on mobile. */
export function SettingsModal() {
  const { section, setSection, closeSettings } = useSettings()
  // On a phone the section list is a sideways strip, and a deep link to
  // Privacy opened with the strip still at General — the open section's tab
  // was off-screen, so nothing said where you were. Bring it into view.
  // scrollLeft on the strip itself, not scrollIntoView, which would also
  // scroll every ancestor.
  const navRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const nav = navRef.current
    const tab = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !tab || nav.scrollWidth <= nav.clientWidth) return
    nav.scrollLeft = Math.max(0, tab.offsetLeft - (nav.clientWidth - tab.offsetWidth) / 2)
  }, [section])
  const { ref, onKeyDown } = useModalDismiss<HTMLDivElement>(closeSettings)
  const t = useT()
  const { isAdmin } = useIsAdmin()
  const { plan } = useAppData()
  const sections = SECTIONS.filter(
    (s) =>
      (!s.adminOnly || isAdmin) &&
      !(PURCHASES_HIDDEN && (s.store === 'never' || (s.store === 'pro' && plan !== 'semester'))),
  )
  // A deep link (or a stale `section`) must not land on a hidden tab, and it
  // must not render a blank panel either. Fall back to the first one.
  const visible = sections.some((s) => s.id === section) ? section : sections[0].id
  const active = sections.find((s) => s.id === visible) ?? sections[0]
  const Body = CONTENT[visible]

  return (
    /*
     * CENTRED ON A DESKTOP, the full page on a phone.
     *
     * It was briefly anchored to the sidebar's bottom-left corner, rising out
     * of the gear that opens it. The idea was that settings is a place you
     * asked to go rather than an interruption — but a 4xl panel pinned to one
     * corner of a wide screen does not read as the sidebar unfolding, it reads
     * as a panel that missed. Restored to the middle, which is where a dialog
     * this size belongs and where it had always been.
     *
     * The SIDEBAR-INTEGRATED treatment now belongs to the avatar menu, which
     * is small enough for it to work: see AvatarMenu.
     */
    <div
      className="ct-animate-fade fixed inset-0 z-50 flex items-stretch justify-center bg-black/55 sm:items-center sm:p-4"
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
        className="ct-animate-pop max-sm:safe-t flex w-full flex-col overflow-hidden bg-surface shadow-2xl outline-none sm:h-[620px] sm:max-h-[88vh] sm:max-w-4xl sm:flex-row sm:rounded-2xl sm:border sm:border-border"
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
          <nav ref={navRef} className="flex gap-1 overflow-x-auto px-2 pt-1 pb-2 sm:flex-col sm:overflow-visible sm:pb-3">
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
