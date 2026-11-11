import { useEffect, useState } from 'react'
import { matchChannels, type Channel } from '@/lib/mentions'
import { searchPeople } from '@/features/community/profile-follows'

export type MentionOption =
  | { kind: 'channel'; channel: Channel }
  | { kind: 'person'; handle: string; name: string | null; avatar: string | null }

export function mentionLabel(o: MentionOption): string {
  return o.kind === 'channel' ? `@${o.channel.name}` : `@${o.handle}`
}

/** The options for what is typed after "@": matching screens first, then people. */
export function useMentionOptions(query: string | null): MentionOption[] {
  const [people, setPeople] = useState<MentionOption[]>([])
  useEffect(() => {
    let alive = true
    const id = window.setTimeout(() => {
      if (query === null || query.length < 1) {
        if (alive) setPeople([])
        return
      }
      void searchPeople(query, 5).then((rows) => {
        if (alive) {
          setPeople(
            rows
              .filter((r) => r.handle)
              .map((r) => ({ kind: 'person' as const, handle: r.handle, name: r.name ?? null, avatar: r.avatar_url ?? null })),
          )
        }
      })
    }, 180)
    return () => {
      alive = false
      window.clearTimeout(id)
    }
  }, [query])
  if (query === null) return []
  const channels = matchChannels(query).map((c) => ({ kind: 'channel' as const, channel: c }))
  return [...channels, ...people].slice(0, 7)
}

