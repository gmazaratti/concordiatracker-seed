import { Bell, PanelLeftClose, Search, Settings } from 'lucide-react'
import { STUDENT_NAV } from '@/app/navigation'
import { Logo } from '@/components/Logo'
import { VerifiedBadge } from '@/features/community/VerifiedBadge'
import { useT } from '@/i18n/i18n'
import { cn } from '@/lib/cn'

/**
 * The app's real sidebar, drawn static for an embed: the same Logo with the
 * collapse control beside it, the same search field, the same destinations
 * and icons (read from STUDENT_NAV, so a nav change shows up here too), and
 * the account row as the ConcordiaTracker brand account shows it: logo
 * avatar, green verified mark, "Administrator", bell and settings.
 *
 * Nothing is wired: the caller renders it inert and pointer-events-none.
 */
export function BrandSidebar() {
  const t = useT()
  return (
    <aside className="hidden w-52 shrink-0 flex-col border-r border-border bg-surface/60 px-3 py-4 sm:flex">
      <div className="flex items-center justify-between px-1">
        <Logo />
        <PanelLeftClose size={16} className="text-subtle" aria-hidden />
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-[11.5px] text-subtle">
        <Search size={13} aria-hidden />
        <span className="flex-1 truncate">Search or jump to…</span>
        <span className="rounded border border-border bg-surface px-1 py-px text-[9.5px] text-muted">Ctrl + K</span>
      </div>

      <nav className="mt-4 space-y-0.5">
        {STUDENT_NAV.map((item, i) => {
          const Icon = item.icon
          const active = i === 0
          return (
            <span
              key={item.to}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px]',
                active ? 'bg-surface-2 font-medium text-fg' : 'text-muted',
              )}
            >
              <Icon size={15} aria-hidden />
              {item.labelKey ? t(item.labelKey) : item.label}
            </span>
          )
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2 pt-3">
        <span className="relative size-8 shrink-0">
          <span className="grid size-8 place-items-center overflow-hidden rounded-full bg-canvas">
            <Logo showText={false} className="[&_svg]:size-8" />
          </span>
          <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-accent ring-2 ring-surface" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1">
            <span className="truncate text-[12px] font-medium text-fg">ConcordiaTracker</span>
            <VerifiedBadge size={12} tone="text-success" label="Staff · ConcordiaTracker" />
          </span>
          <span className="block truncate text-[10.5px] font-medium text-accent">Administrator</span>
        </span>
        <Bell size={14} className="shrink-0 text-subtle" aria-hidden />
        <Settings size={14} className="shrink-0 text-subtle" aria-hidden />
      </div>
    </aside>
  )
}

/**
 * The real app's phone top bar (StudentLayout, below `md`): the Logo on the
 * left, search and the account avatar on the right. It stands in for the
 * sidebar when the embed is phone-sized, so the phone preview is the mobile
 * Today, not a shrunken desktop.
 */
export function BrandMobileBar() {
  return (
    <div className="-mx-4 -mt-4 mb-4 flex items-center justify-between border-b border-border px-4 py-3 sm:hidden">
      <Logo />
      <div className="flex items-center gap-3">
        <Search size={18} className="text-muted" aria-hidden />
        <span className="relative grid size-8 place-items-center rounded-full bg-surface">
          <Logo showText={false} />
          <span className="absolute top-0 right-0 size-2 rounded-full bg-accent ring-2 ring-canvas" aria-hidden />
        </span>
      </div>
    </div>
  )
}
