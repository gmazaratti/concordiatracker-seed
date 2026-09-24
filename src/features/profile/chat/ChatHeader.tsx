import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Eye, Palette } from 'lucide-react'
import { VerifiedBadge } from '@/features/community/VerifiedBadge'
import { Switch } from '@/features/settings/controls'
import type { Friend } from '@/lib/social'
import { CHAT_THEMES, type ChatTheme } from '../chat-themes'
import { Avatar } from './ChatAvatar'
import type { Badge } from '../badges'
import { cn } from '@/lib/cn'

/**
 * Who you are talking to, and the two settings that belong to this chat.
 *
 * ON A PHONE EVERYTHING HAS TO FIT 375px. The name column is the only thing
 * allowed to shrink (`min-w-0 flex-1`, truncating); the back button, the face
 * and the two icons are `shrink-0` so they can never be pushed out of frame by
 * a long name. The popovers are anchored to the RIGHT edge and capped at the
 * viewport width, so on a narrow screen they open inward instead of off the
 * side.
 */
export function ChatHeader({
  friend,
  badge,
  onBack,
  receipts,
  onReceipts,
  theme,
  pro,
  onTheme,
  onUpgrade,
}: {
  friend: Friend
  badge?: Badge
  onBack?: () => void
  receipts: boolean
  onReceipts: (on: boolean) => void
  theme: ChatTheme
  pro: boolean
  onTheme: (id: string) => void
  onUpgrade: () => void
}) {
  const [open, setOpen] = useState<null | 'receipts' | 'theme'>(null)
  const wrap = useRef<HTMLDivElement>(null)

  // Outside click and Escape close whichever is open.
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(null)
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  const icon =
    'grid size-9 place-items-center rounded-full text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg sm:size-8 sm:rounded-lg'
  const pop =
    'ct-animate-pop absolute top-full right-0 z-30 mt-1.5 max-w-[calc(100vw-1.5rem)] rounded-xl border border-border bg-surface shadow-2xl'

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border/70 px-2 py-2 sm:gap-2.5 sm:px-3 sm:py-2.5">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="grid size-9 shrink-0 place-items-center rounded-full text-fg transition-colors duration-150 hover:bg-surface-2 lg:hidden"
        >
          <ChevronLeft size={24} aria-hidden />
        </button>
      )}
      <Avatar friend={friend} size={34} />
      <div className="min-w-0 flex-1">
        <Link
          to={`/@${friend.handle}`}
          className="flex min-w-0 items-center gap-1 text-[14px] font-semibold text-fg hover:underline sm:text-[13.5px] sm:font-medium"
        >
          {/* `min-w-0`: a flex item will not shrink below its content without
              it, so `truncate` alone never engaged and a long name shoved the
              two icons off the right edge of a phone. */}
          <span className="min-w-0 truncate">{friend.name ?? friend.handle}</span>
          {badge && <VerifiedBadge size={14} tone={badge.tone} label={badge.label} />}
        </Link>
        <p className="truncate text-[11.5px] text-subtle">@{friend.handle}</p>
      </div>

      <div ref={wrap} className="relative flex shrink-0 items-center">
        {/* Read receipts, per conversation. RECIPROCAL: they show only when
            both of you have them on, so turning yours off also hides theirs
            from you - the trade that stops it being a one-way tracker. */}
        <button
          type="button"
          onClick={() => setOpen((o) => (o === 'receipts' ? null : 'receipts'))}
          aria-label="Read receipts"
          aria-expanded={open === 'receipts'}
          title="Read receipts"
          className={cn(icon, open === 'receipts' && 'bg-surface-2 text-fg')}
        >
          <Eye size={17} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => (pro ? setOpen((o) => (o === 'theme' ? null : 'theme')) : onUpgrade())}
          aria-label="Chat colours"
          aria-expanded={open === 'theme'}
          title={pro ? 'Chat colours' : 'Chat colours come with the Semester pass'}
          className={cn(icon, open === 'theme' && 'bg-surface-2 text-fg')}
        >
          <Palette size={17} aria-hidden />
        </button>

        {open === 'receipts' && (
          <div className={cn(pop, 'w-[236px] p-3')}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-fg">Read receipts</span>
              <Switch checked={receipts} onChange={onReceipts} label="Read receipts in this chat" />
            </div>
            <p className="mt-1.5 text-[11.5px] leading-snug text-subtle">
              Just this chat. They only show when you both have them on. Turn yours off and you
              won&apos;t see theirs either.
            </p>
          </div>
        )}
        {open === 'theme' && (
          <div className={cn(pop, 'w-[212px] p-2.5')}>
            <p className="mb-2 px-0.5 text-[11px] text-subtle">Just for you. They see their own.</p>
            <div className="grid grid-cols-3 gap-2">
              {CHAT_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    onTheme(t.id)
                    setOpen(null)
                  }}
                  aria-label={t.label}
                  title={t.label}
                  className={cn(
                    'h-11 overflow-hidden rounded-lg border transition-transform duration-150 hover:scale-105',
                    theme.id === t.id ? 'border-accent' : 'border-border',
                  )}
                  style={{ backgroundColor: t.bg || 'var(--ct-canvas)' }}
                >
                  <span
                    className="mx-auto mt-4 block h-3 w-8 rounded-full"
                    style={{ backgroundColor: t.bubble || 'var(--ct-accent)' }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
