import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { MobileNav } from '@/components/MobileNav'
import { Logo } from '@/components/Logo'
import { AvatarMenu } from '@/components/AvatarMenu'
import { CommandPalette } from '@/command/CommandPalette'
import { QuickActionLayer } from '@/command/QuickActionLayer'

/** Chrome for the authenticated student app context. */
export function StudentLayout() {
  return (
    <div className="flex h-svh overflow-hidden">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <Logo />
          <AvatarMenu align="top" compact />
        </header>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>

      <MobileNav />
      <CommandPalette />
      <QuickActionLayer />
    </div>
  )
}
