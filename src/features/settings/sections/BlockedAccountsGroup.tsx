import { useEffect, useState } from 'react'
import { PersonAvatar } from '@/features/community/PersonAvatar'
import { listBlocks, unblockUser, type BlockedUser } from '@/lib/social'
import { Group } from '../controls'

/**
 * Settings → Privacy → Blocked accounts.
 *
 * The one place a block can be undone: a blocked person's profile will not
 * open (that is the point of blocking), so the Unblock in its ⋯ menu is
 * unreachable afterwards. Blocks are made from a profile or a conversation;
 * this list only ever removes them.
 */
export function BlockedAccountsGroup() {
  const [rows, setRows] = useState<BlockedUser[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    void listBlocks().then((r) => alive && setRows(r))
    return () => {
      alive = false
    }
  }, [])

  async function unblock(handle: string) {
    setBusy(handle)
    setError('')
    const ok = await unblockUser(handle)
    setBusy(null)
    if (ok) setRows((r) => (r ?? []).filter((b) => b.handle !== handle))
    else setError('That did not go through. Nothing changed.')
  }

  return (
    <Group label="Blocked accounts">
      {rows === null ? (
        <p className="px-4 py-3 text-[12.5px] text-subtle">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-3 text-[12.5px] leading-relaxed text-subtle">
          You haven&rsquo;t blocked anyone. Block someone from the ⋯ on their profile or in a
          conversation; they won&rsquo;t be told.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((b) => (
            <li key={b.handle} className="flex items-center gap-3 px-4 py-2.5">
              <PersonAvatar person={b} className="size-8 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-fg">{b.name ?? `@${b.handle}`}</span>
                <span className="block truncate text-[11.5px] text-subtle">@{b.handle}</span>
              </span>
              <button
                type="button"
                disabled={busy === b.handle}
                onClick={() => void unblock(b.handle)}
                className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium text-fg transition-colors duration-150 hover:bg-surface-2 disabled:opacity-50"
              >
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="px-4 pb-3 text-[12px] text-danger">{error}</p>}
    </Group>
  )
}
