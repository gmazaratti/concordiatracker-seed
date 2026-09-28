import { useAppData } from '@/app/providers/app-data'
import { FallbackImg } from '@/components/ui/FallbackImg'
import { cn } from '@/lib/cn'

/**
 * The signed-in person's own face, read from the ONE live source (the profile
 * row in AppDataProvider). Every place that shows "you" renders this, so a new
 * photo lands everywhere on the same frame instead of on whichever screen
 * happened to read it: the Settings header kept showing initials after the
 * photo row beside it had already changed.
 *
 * The initials are always drawn underneath, so a slow or dead URL shows them
 * rather than an empty circle.
 */
export function UserAvatar({ className, textClass }: { className: string; textClass?: string }) {
  const { user } = useAppData()
  return (
    <span className={cn('relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-accent-soft font-semibold text-accent', className, textClass)}>
      <span aria-hidden>{user.initials}</span>
      {user.avatarUrl && (
        <FallbackImg
          src={user.avatarUrl}
          className="absolute inset-0 size-full rounded-full bg-surface-2 object-cover"
        />
      )}
    </span>
  )
}
