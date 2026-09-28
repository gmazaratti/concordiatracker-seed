import { CloudUpload } from 'lucide-react'
import { pendingIdsIn, usePendingWrites } from '@/lib/offline-fetch'
import { cn } from '@/lib/cn'

/**
 * "This row has a change waiting to reach the server." Shown beside anything
 * edited offline (lib/offline-fetch queues the write), so a tick made in the
 * metro visibly says it has not landed yet, then quietly disappears when it
 * has. Renders nothing for everything else.
 */
export function PendingSyncMark({ table, id, className }: { table: string; id: string; className?: string }) {
  const queue = usePendingWrites()
  if (!queue.length || !pendingIdsIn(queue, table).has(id)) return null
  return (
    <span
      role="status"
      title="Waiting to sync"
      className={cn('inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-subtle', className)}
    >
      <CloudUpload size={12} aria-hidden />
      <span>Waiting to sync</span>
    </span>
  )
}
