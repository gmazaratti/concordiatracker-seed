import { useEffect, useMemo, useState } from 'react'
import { AtSign, Users } from 'lucide-react'
import { useCommunity } from '@/features/community/useCommunity'
import { searchPeople, type PublicPerson } from '@/features/community/profile-follows'
import type { Command } from './commands'

/**
 * People and clubs, as palette rows.
 *
 * The palette is the app's navigation spine, and a person or a club is a
 * destination like any course — but it only knew courses and commands, so a
 * handle typed into it found nothing and the only people search lived three
 * screens deep in Messages → New message (QA, 2026-09-26).
 *
 * Clubs are matched against the list the app already holds, so they appear
 * as you type. People need the server (the directory respects each profile's
 * privacy), so that query waits for a pause in typing and for two characters.
 * A leading "@" is dropped before matching: every handle is DISPLAYED with one,
 * so it is the first thing anybody types.
 */
export function usePeopleCommands(query: string): { commands: Command[]; searching: boolean } {
  const { searchOrgs } = useCommunity()
  const q = query.trim().replace(/^@/, '')
  const [people, setPeople] = useState<{ q: string; rows: PublicPerson[] }>({ q: '', rows: [] })

  useEffect(() => {
    if (q.length < 2) return
    let live = true
    const t = window.setTimeout(() => {
      void searchPeople(q, 5).then((rows) => {
        if (live) setPeople({ q, rows })
      })
    }, 220)
    return () => {
      live = false
      window.clearTimeout(t)
    }
  }, [q])

  const commands = useMemo<Command[]>(() => {
    if (q.length < 2) return []
    const clubs: Command[] = searchOrgs(q)
      .slice(0, 4)
      .map((o) => {
        const slug = o.handle.replace(/^@/, '')
        return {
          id: `org-${slug}`,
          title: o.name,
          hint: `@${slug}`,
          group: 'Actions',
          icon: Users,
          dynamic: true,
          perform: (ctx) => {
            ctx.navigate(`/app/community/org/${slug}`)
            ctx.close()
          },
        }
      })
    // Only rows answered for THIS query, so a stale reply never shows under
    // what is typed now.
    const persons: Command[] = (people.q === q ? people.rows : [])
      .filter((p) => p.handle)
      .map((p) => ({
        id: `person-${p.handle}`,
        title: p.name || `@${p.handle}`,
        hint: `@${p.handle}`,
        group: 'Actions',
        icon: AtSign,
        dynamic: true,
        perform: (ctx) => {
          ctx.navigate(`/@${p.handle}`)
          ctx.close()
        },
      }))
    return [...persons, ...clubs]
  }, [q, people, searchOrgs])

  return { commands, searching: q.length >= 2 && people.q !== q }
}
