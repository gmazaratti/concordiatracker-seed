import { AlertTriangle, ChevronLeft, FileText, Loader2 } from 'lucide-react'
import type { OrgOption } from '@/lib/collab'
import type { PostDetailsValue } from '@/lib/post-details'
import { cn } from '@/lib/cn'
import type { PublishableOrg } from '../../useMyOrgs'
import { PostDetails } from '../PostDetails'
import { CollabPicker } from './CollabPicker'
import { PhotoFrame } from './PhotoFrame'
import type { ComposeItem } from './items'

/**
 * Screen 3 of 3: the words, the settings, and Share.
 *
 * SHARE LIVES AT THE BOTTOM AND STAYS THERE, full width, the way the reference
 * has it: it is the one thing everyone on this screen came to press.
 *
 * SAVE AS DRAFT sits beside it. A club member whose role lets them draft but
 * not publish sees ONLY that — the database refuses them the other one anyway,
 * and a Share button that can only fail is a worse sentence than its absence.
 * Whoever can publish then finds it under Drafts and posts it.
 */
export function ShareStep({
  org,
  items,
  ratio,
  caption,
  onCaption,
  details,
  onDetails,
  invitees,
  pickingCollab,
  onCollabOpen,
  onCollabClose,
  onCollabAdd,
  onCollabRemove,
  canPublish,
  editingDraft,
  busy,
  progress,
  error,
  onError,
  onBack,
  onShare,
  onSaveDraft,
}: {
  org: PublishableOrg
  items: ComposeItem[]
  ratio: number
  caption: string
  onCaption: (v: string) => void
  details: PostDetailsValue
  onDetails: (p: Partial<PostDetailsValue>) => void
  invitees: OrgOption[]
  pickingCollab: boolean
  onCollabOpen: () => void
  onCollabClose: () => void
  onCollabAdd: (o: OrgOption) => void
  onCollabRemove: (id: string) => void
  canPublish: boolean
  editingDraft: boolean
  busy: 'share' | 'draft' | null
  progress: string | null
  error: string | null
  onError: (m: string) => void
  onBack: () => void
  onShare: () => void
  onSaveDraft: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="grid size-10 place-items-center rounded-full bg-surface-2 text-fg transition-colors hover:bg-surface"
        >
          <ChevronLeft size={22} aria-hidden />
        </button>
        <h2 className="flex-1 text-center text-[16px] font-semibold text-fg">
          {editingDraft ? 'Draft' : 'New post'}
        </h2>
        <span className="size-10" />
      </header>

      {error && (
        <p role="alert" className="mx-3 mb-2 flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-[12.5px] text-fg">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-danger" aria-hidden />
          <span className="min-w-0">{error}</span>
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex gap-2.5 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
          {items.map((it) => (
            <div key={it.key} className="w-[44%] max-w-[210px] shrink-0">
              <PhotoFrame item={it} ratio={ratio} className="rounded-xl" />
            </div>
          ))}
        </div>

        <div className="px-4">
          <textarea
            value={caption}
            onChange={(e) => onCaption(e.target.value)}
            rows={3}
            maxLength={2200}
            placeholder="Add a caption..."
            className="w-full resize-none bg-transparent py-2 text-[15px] text-fg placeholder:text-subtle focus:outline-none"
          />
          <PostDetails
            orgId={org.id}
            caption={caption}
            value={details}
            onChange={onDetails}
            onError={onError}
          />
          <CollabPicker
            org={org}
            invitees={invitees}
            open={pickingCollab}
            onOpen={onCollabOpen}
            onClose={onCollabClose}
            onAdd={onCollabAdd}
            onRemove={onCollabRemove}
          />
          <p className="py-4 text-[11.5px] text-subtle">
            Posting as {org.handle.replace(/^@/, '')}
            {!canPublish && ' · your role can save drafts; someone who can publish will post it'}
          </p>
        </div>
      </div>

      <div className="border-t border-border px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {progress && <p className="mb-2 text-center text-[12px] text-subtle">{progress}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={busy !== null}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-3 text-[14px] font-semibold text-fg transition-colors hover:bg-surface-2 disabled:opacity-60',
              canPublish ? 'shrink-0' : 'flex-1',
            )}
          >
            {busy === 'draft' ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <FileText size={15} aria-hidden />}
            {editingDraft ? 'Save draft' : 'Save as draft'}
          </button>
          {canPublish && (
            <button
              type="button"
              onClick={onShare}
              disabled={busy !== null}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-[15px] font-semibold text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {busy === 'share' && <Loader2 size={15} className="animate-spin" aria-hidden />}
              Share
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
