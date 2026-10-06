import { createPortal } from 'react-dom'
import { ChevronLeft } from 'lucide-react'
import { useModalDismiss } from '@/app/hooks/useModalDismiss'
import type { FeedPost } from '@/lib/social-posts'
import { CommentsSheet } from './CommentsSheet'
import { PostCard } from './PostCard'
import { useIsDesktop } from './useIsDesktop'

/**
 * A post opened from a profile grid, full screen.
 *
 * On a desktop that is the same two-pane view opening comments gives you:
 * the picture at its own size on the left and the conversation beside it.
 * On a phone it is the whole card on its own screen, with a back arrow,
 * since a phone has no room for two panes and the card already carries the
 * likes, the caption and the comment button.
 */
export function PostLightbox({
  post,
  canManage,
  onChanged,
  onClose,
}: {
  post: FeedPost
  canManage?: boolean
  onChanged?: () => void
  onClose: () => void
}) {
  const desktop = useIsDesktop()
  if (desktop) return <CommentsSheet post={post} onCount={() => {}} onClose={onClose} />
  return <PhonePost post={post} canManage={canManage} onChanged={onChanged} onClose={onClose} />
}

function PhonePost({
  post,
  canManage,
  onChanged,
  onClose,
}: {
  post: FeedPost
  canManage?: boolean
  onChanged?: () => void
  onClose: () => void
}) {
  const { ref, onKeyDown } = useModalDismiss<HTMLDivElement>(onClose)
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Post"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (!e.defaultPrevented) onKeyDown(e)
      }}
      className="ct-animate-fade fixed inset-0 z-[90] flex flex-col bg-canvas"
    >
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border/70 px-2 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="grid size-10 place-items-center rounded-full text-fg hover:bg-surface-2"
        >
          <ChevronLeft size={22} aria-hidden />
        </button>
        <h2 className="text-[15px] font-semibold text-fg">Post</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <PostCard
          post={post}
          canManage={canManage}
          onChanged={onChanged}
        />
      </div>
    </div>,
    document.body,
  )
}
