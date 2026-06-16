import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  GraduationCap,
  LogOut,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useSettings } from '@/app/providers/settings'
import type { Plan } from '@/data/types'
import { ThemeSwitcher } from './ThemeSwitcher'
import { cn } from '@/lib/cn'

/**
 * Profile menu — the home for everything that deliberately ISN'T a sidebar
 * tab (Settings, Teacher portal, marketing site, theme, sign out), keeping
 * the sidebar to exactly the four destinations.
 */
export function AvatarMenu({
  align = 'bottom',
  compact = false,
}: {
  align?: 'bottom' | 'top'
  compact?: boolean
}) {
  const { user, plan, setPlan } = useAppData()
  const { openSettings } = useSettings()
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
          'flex items-center gap-2.5 rounded-lg text-left transition-colors duration-150 hover:bg-surface-2',
          compact ? 'p-0.5' : 'w-full p-1.5',
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent">
          {user.initials}
        </span>
        {!compact && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-fg">
              {user.name}
            </span>
            <span className="block truncate text-[11px] text-subtle">
              {plan === 'free' ? 'Free plan' : 'Semester pass'}
            </span>
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
          <MenuButton
            icon={Settings}
            onSelect={() => {
              setOpen(false)
              openSettings()
            }}
          >
            Settings
          </MenuButton>
          <MenuLink to="/teacher" icon={GraduationCap} onSelect={() => setOpen(false)}>
            Teacher portal
          </MenuLink>
          <MenuLink to="/" icon={ArrowLeft} onSelect={() => setOpen(false)}>
            Back to landing page
          </MenuLink>

          <div className="my-1.5 px-1">
            <p className="px-1 pb-1 text-[11px] text-subtle">Theme</p>
            <ThemeSwitcher />
          </div>

          <div className="my-1.5 px-1">
            <p className="flex items-center gap-1.5 px-1 pb-1 text-[11px] text-subtle">
              Demo plan
              <span className="rounded bg-surface-2 px-1 py-0.5 text-[9px] font-medium tracking-wide text-subtle uppercase">
                Dev
              </span>
            </p>
            <PlanToggle plan={plan} onChange={setPlan} />
          </div>

          <button
            type="button"
            role="menuitem"
            disabled
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-subtle"
            title="Auth is mocked in this seed"
          >
            <LogOut size={16} aria-hidden />
            Sign out
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

/** A menu row that fires an action instead of navigating (e.g. open Settings). */
function MenuButton({
  icon: Icon,
  onSelect,
  children,
}: {
  icon: LucideIcon
  onSelect: () => void
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
      {children}
    </button>
  )
}
