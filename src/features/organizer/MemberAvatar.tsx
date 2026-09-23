import type { OrgMember } from '@/data/teacher'
import { useAppData } from '@/app/providers/app-data'
import { FallbackImg } from '@/components/ui/FallbackImg'
import { initialsOf } from '@/lib/initials'
import { cn } from '@/lib/cn'

/** Deterministic tints keyed off the name, so a team without photos still
 *  reads as a set of people. Fixed hexes, the same in every theme. */
const HUES = ['#5b9cf6', '#a78bfa', '#22b8a6', '#e0853c', '#ec4899', '#4fb89a']

function hueFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}

/** A teammate's face: their photo, your own live photo for "You", else
 *  initials on a tint that stays the same everywhere they appear. */
export function MemberAvatar({
  member,
  className = 'size-9',
  textClass = 'text-[12px]',
}: {
  member: Pick<OrgMember, 'name' | 'email' | 'avatarUrl' | 'isYou'>
  className?: string
  textClass?: string
}) {
  const { user } = useAppData()
  const photo = member.avatarUrl || (member.isYou ? user.avatarUrl : undefined)
  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold text-white',
        className,
        textClass,
      )}
      style={{ backgroundColor: hueFor(member.email || member.name || '?') }}
      aria-hidden
    >
      {initialsOf(member.name, member.email)}
      <FallbackImg src={photo} className="absolute inset-0 size-full object-cover" />
    </span>
  )
}
