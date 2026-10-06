import { useState } from 'react'
import { Link } from 'react-router-dom'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { ArrowUpRight } from 'lucide-react'
import { PersonAvatar } from '@/features/community/PersonAvatar'
import { usePublicProfile } from '@/features/profile/usePublicProfile'
import { ChipPopover } from './ChipPopover'

/** "@Name" in the text. Clicking it shows who that is, and their profile if it is public. */
export function MentionChip({ node }: NodeViewProps) {
  const [open, setOpen] = useState(false)
  const [chip, setChip] = useState<HTMLSpanElement | null>(null)
  const handle = (node.attrs.handle as string | null) ?? null
  const label = String(node.attrs.label ?? handle ?? 'Someone')
  return (
    <NodeViewWrapper as="span" className="inline">
      <span ref={setChip} role="button" tabIndex={0} contentEditable={false} onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === 'Enter' && setOpen((o) => !o)}
        className="cursor-pointer rounded-md bg-accent-soft px-1 py-px font-medium text-accent hover:underline">
        @{label}
      </span>
      {open && (
        <ChipPopover anchor={chip} onClose={() => setOpen(false)} label={label}>
          <ProfileCard handle={handle} label={label} />
        </ChipPopover>
      )}
    </NodeViewWrapper>
  )
}

function ProfileCard({ handle, label }: { handle: string | null; label: string }) {
  const { profile, loading } = usePublicProfile(handle ?? '')
  if (!handle) return <p className="text-[13px] text-fg">{label}</p>
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <PersonAvatar person={{ name: profile?.name ?? label, handle, avatar_url: profile?.avatarUrl ?? null }} className="size-11 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-fg">{profile?.name || label}</p>
          <p className="truncate text-[12.5px] text-muted">@{handle}</p>
        </div>
      </div>
      {loading ? (
        <div className="ct-shimmer h-4 w-2/3 rounded" />
      ) : profile?.isPublic ? (
        <>
          {profile.program && <p className="text-[12.5px] text-muted">{profile.program}</p>}
          <Link to={`/@${handle}`} className="inline-flex items-center gap-1 self-start rounded-md bg-surface-2 px-2.5 py-1.5 text-[12.5px] font-medium text-fg hover:bg-border">
            View profile <ArrowUpRight size={13} aria-hidden />
          </Link>
        </>
      ) : (
        <p className="text-[12.5px] text-subtle">This profile is private.</p>
      )}
    </div>
  )
}
