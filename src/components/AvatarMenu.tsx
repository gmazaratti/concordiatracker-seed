import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  Compass,
  GraduationCap,
  LifeBuoy,
  LogOut,
  Megaphone,
  MessagesSquare,
  Bell,
  Settings,
  UserRound,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useAuth } from '@/app/providers/auth'
import { useSettings } from '@/app/providers/settings'
import { useActivityBadge } from '@/app/usePeopleBadge'
import { useSupport } from '@/app/providers/support'
import { useUpdates } from '@/app/providers/updates'
import { useIsAdmin } from '@/features/admin/admin-data'
import { useTeacher } from '@/app/providers/teacher'
import { useTour } from '@/features/tour/tour'
import { VerifiedBadge } from '@/features/community/VerifiedBadge'
import { TOUR_STEPS } from '@/features/tour/steps'
import type { Plan } from '@/data/types'
import { useT } from '@/i18n/i18n'
import { cn } from '@/lib/cn'
import { badgeForPerson } from '@/features/profile/badges'
import { useCommunityData } from '@/app/providers/community-data'

/** The people who built this — badged with a verification seal in the profile
 * block (cosmetic; admin rights are gated separately in the DB). Kept as
 * emails because this block has the signed-in user, not a looked-up profile. */
const FOUNDER_EMAILS = new Set(['alexxdegryse@gmail.com', 'concordiatracker@gmail.com'])

/**
 * Profile menu — the home for everything that deliberately ISN'T a sidebar
 * tab (Settings, Teacher portal, marketing site, sign out), keeping
 * the sidebar to exactly the four destinations.
 */
export function AvatarMenu({
  align = 'bottom',
  compact = false,
  icon,
}: {
  align?: 'bottom' | 'top'
  compact?: boolean
  /**
   * Replaces the avatar on the trigger. The profile page passes a hamburger:
   * the whole screen is already your face, and a second copy of it in the bar
   * above reads as a control that goes somewhere, which it does not.
   */
  icon?: React.ReactNode
}) {
  const { user, plan, setPlan } = useAppData()
  const { signOut } = useAuth()
  const { openSettings } = useSettings()
  const bell = useActivityBadge()
  const { openSupport } = useSupport()
  const { showIndicator, openHistory } = useUpdates()
  /*
   * Staff comes from the email set above (this block has the signed-in user,
   * not a fetched profile); organizer is derived from owning an approved org,
   * so a club president sees "Organizer" without anyone granting it.
   */
  const { orgNameByOwner } = useCommunityData()
  const { session } = useAuth()
  const badge = FOUNDER_EMAILS.has(user.email.toLowerCase())
    // By handle, with no fallback: guessing a founder identity when the
    // handle is missing would put someone else's role on this account.
    ? badgeForPerson(user.handle)
    : badgeForPerson(null, session?.user?.id ? orgNameByOwner[session.user.id] : undefined)
  const { isAdmin } = useIsAdmin()
  const { myOrg } = useTeacher()
  const { start } = useTour()
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex shrink-0 items-center gap-2.5 rounded-lg text-left transition-colors duration-150 hover:bg-surface-2',
          compact ? 'p-0.5' : 'w-full p-1.5',
        )}
      >
        <span className="relative size-8 shrink-0">
          {icon ? (
            <span className="grid size-8 place-items-center rounded-lg text-fg">{icon}</span>
          ) : user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="size-8 rounded-full bg-surface-2 object-cover"
            />
          ) : (
            <span className="grid size-8 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent">
              {user.initials}
            </span>
          )}
          {/* Persistent unseen-update cue on the always-visible profile avatar
           * (both the mobile top bar and the desktop sidebar footer), so it never
           * shifts layout. The "What's new" menu item below is its destination. */}
          {showIndicator && (
            <span
              className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-accent ring-2 ring-canvas"
              aria-hidden
            />
          )}
        </span>
        {!compact && (
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1">
              <span className="truncate text-[13px] font-medium text-fg">{user.name}</span>
              {badge && <VerifiedBadge size={13} tone={badge.tone} label={badge.label} />}
            </span>
            {/* The role where the plan usually goes. Someone who runs a club
                reads "Organizer" the same way the founder reads "Founder" —
                it is the most useful thing to say about that account, and the
                plan is in Settings. */}
            {badge ? (
              <span className="block truncate text-[11px] font-medium text-accent">
                {badge.role}
              </span>
            ) : (
              <span className="block truncate text-[11px] text-subtle">
                {plan === 'free' ? 'Free plan' : 'Semester pass'}
              </span>
            )}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'ct-animate-pop absolute z-40 rounded-xl border border-border bg-surface p-1.5 shadow-2xl',
            compact ? 'right-0 w-60' : 'right-0 left-0',
            align === 'bottom' ? 'bottom-full mb-2' : 'top-full mt-2',
          )}
        >
          {/* Your own profile, first. It is the page every other social
              action starts from, and until now the only way to reach it was to
              already know your own handle and type the URL. */}
          {user.handle && (
            <MenuLink
              to={`/@${user.handle}`}
              icon={UserRound}
              onSelect={() => setOpen(false)}
            >
              My profile
            </MenuLink>
          )}
          {/* Notifications were reachable from exactly one place: a bell that
              only exists inside Community. Nobody hunts for a bell on a page
              they are not on, so there is a door here too, on every screen. */}
          <MenuLink
            to="/app/community?activity=1"
            icon={Bell}
            onSelect={() => setOpen(false)}
          >
            Notifications
            {bell > 0 && (
              <span className="ml-auto rounded-full bg-accent px-1.5 text-[10.5px] font-semibold text-accent-contrast">
                {bell}
              </span>
            )}
          </MenuLink>
          <MenuButton
            icon={Settings}
            onSelect={() => {
              setOpen(false)
              openSettings()
            }}
          >
            {t('nav.settings')}
          </MenuButton>
          <MenuButton
            icon={Megaphone}
            indicator={showIndicator}
            onSelect={() => {
              setOpen(false)
              openHistory()
            }}
          >
            {t('nav.whatsNew')}
          </MenuButton>
          <MenuLink to="/app/requests" icon={MessagesSquare} onSelect={() => setOpen(false)}>
            {t('nav.feedback')}
          </MenuLink>
          <MenuButton
            icon={LifeBuoy}
            onSelect={() => {
              setOpen(false)
              openSupport()
            }}
          >
            {t('nav.support')}
          </MenuButton>
          <MenuButton
            icon={Compass}
            onSelect={() => {
              setOpen(false)
              start(TOUR_STEPS)
            }}
          >
            {t('nav.takeTour')}
          </MenuButton>
          {/* Deferred contexts: admin-only so regular users don't wander into the
           * half-wired teacher/organizer flows. (Their routes also gate access.) */}
          {isAdmin && (
            <MenuLink to="/teacher" icon={GraduationCap} onSelect={() => setOpen(false)}>
              {t('nav.teacherPortal')}
            </MenuLink>
          )}
          {/* Visible to anyone who owns or helps run an org (not just admin). */}
          {(isAdmin || myOrg) && (
            <MenuLink to="/organizer" icon={CalendarDays} onSelect={() => setOpen(false)}>
              {t('nav.organizerPortal')}
            </MenuLink>
          )}
          {/* Admin-only: hidden for everyone but the platform administrator. The
           * route + every RPC are independently gated, so this is the UX layer only. */}
          {isAdmin && (
            <MenuLink to="/admin" icon={ShieldCheck} onSelect={() => setOpen(false)}>
              {t('nav.adminPanel')}
            </MenuLink>
          )}
          <MenuLink to="/" icon={ArrowLeft} onSelect={() => setOpen(false)}>
            {t('nav.landing')}
          </MenuLink>

          {/* Dev-only plan switch (self-grants "Semester"): admin-only so real
           * users can't flip their own plan. Real upgrades go through Settings → Billing. */}
          {isAdmin && (
            <div className="my-1.5 px-1">
              <p className="flex items-center gap-1.5 px-1 pb-1 text-[11px] text-subtle">
                Demo plan
                <span className="rounded bg-surface-2 px-1 py-0.5 text-[9px] font-medium tracking-wide text-subtle uppercase">
                  Dev
                </span>
              </p>
              <PlanToggle plan={plan} onChange={setPlan} />
            </div>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              void signOut()
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
          >
            <LogOut size={16} aria-hidden />
            {t('nav.signOut')}
          </button>
        </div>
      )}
    </div>
  )
}

const PLAN_OPTIONS: { value: Plan; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'semester', label: 'Semester' },
]

/** Dev-only segmented control to demo both monetization states without a backend. */
function PlanToggle({
  plan,
  onChange,
}: {
  plan: Plan
  onChange: (plan: Plan) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Demo plan"
      className="flex gap-1 rounded-lg bg-surface-2 p-1"
    >
      {PLAN_OPTIONS.map((opt) => {
        const active = plan === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 rounded-md px-2 py-1 text-[12px] font-medium transition-colors duration-150',
              active
                ? 'bg-accent text-accent-contrast'
                : 'text-muted hover:text-fg',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function MenuLink({
  to,
  icon: Icon,
  onSelect,
  children,
}: {
  to: string
  icon: LucideIcon
  onSelect: () => void
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onSelect}
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
    >
      <Icon size={16} aria-hidden />
      {children}
    </Link>
  )
}

/** A menu row that fires an action instead of navigating (e.g. open Settings).
 * An optional trailing dot surfaces an unseen state (the "what's new" cue). */
function MenuButton({
  icon: Icon,
  onSelect,
  indicator = false,
  children,
}: {
  icon: LucideIcon
  onSelect: () => void
  indicator?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
    >
      <Icon size={16} aria-hidden />
      <span className="flex-1">{children}</span>
      {indicator && <span className="size-1.5 rounded-full bg-accent" aria-hidden />}
    </button>
  )
}
