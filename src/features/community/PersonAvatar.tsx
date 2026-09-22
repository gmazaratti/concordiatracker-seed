import { useState } from 'react'
import { CachedImg } from '@/components/ui/CachedImg'
import { cn } from '@/lib/cn'
import type { PublicPerson } from './profile-follows'

/**
 * A person, as a round avatar.
 *
 * Round on purpose: orgs get a rounded SQUARE logo everywhere in this app, so
 * the two kinds of account stay distinguishable in a mixed list without a label
 * doing the work. Shape is the fastest signal there is.
 */
export function PersonAvatar({
  person,
  className = 'size-8',
}: {
  person: Pick<PublicPerson, 'handle' | 'name' | 'avatar_url'>
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  const initials =
    (person.name ?? person.handle)
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'

  /*
   * A FACE MUST NOT BLINK. `CachedImg` paints a picture this session has
   * already decoded on the first frame instead of starting from an empty box
   * — which is what made the same avatar fade in again every time you walked
   * between Messages and a profile.
   *
   * A genuine failure falls through to the initials rather than leaving a
   * broken frame, and is NOT remembered as loaded, so it retries next time.
   */
  return person.avatar_url && !broken ? (
    <CachedImg
      src={person.avatar_url}
      eager
      onFailed={() => setBroken(true)}
      className={cn('shrink-0 rounded-full bg-surface-2 object-cover', className)}
    />
  ) : (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent',
        className,
      )}
    >
      {initials}
    </span>
  )
}
