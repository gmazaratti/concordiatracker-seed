import { Search } from 'lucide-react'
import { formatShortcut, useCommandPalette } from '@/app/providers/command-palette'
import { cn } from '@/lib/cn'

/** Opens the command palette — the desktop entry point to the nav spine. */
export function SearchTrigger({ className }: { className?: string }) {
  const { openPalette, shortcut } = useCommandPalette()
  return (
    <button
      type="button"
      onClick={openPalette}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-left text-[13px] text-subtle transition-colors duration-150 hover:border-border-strong hover:text-muted',
        className,
      )}
    >
      <Search size={15} aria-hidden />
      <span className="flex-1 truncate">Search or jump to…</span>
      <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted">
        {formatShortcut(shortcut)}
      </kbd>
    </button>
  )
}
