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
  const initials =
    (person.name ?? person.handle)
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'

  return person.avatar_url ? (
    <img
      src={person.avatar_url}
      alt=""
      referrerPolicy="no-referrer"
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
