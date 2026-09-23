import { useEffect, useState } from 'react'
import { Loader2, UserRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { initialsOf } from '@/lib/initials'

interface Person {
  user_id: string
  name: string | null
  handle: string | null
  avatar_url: string | null
  email: string | null
  joined_at: string
  detail: string | null
  referrer_handle: string | null
  referrer_name: string | null
  referrer_avatar: string | null
}

function Face({ src, name, handle, size = 28 }: { src: string | null; name: string | null; handle: string | null; size?: number }) {
  return src ? (
    <img src={src} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-surface-2 text-[10.5px] font-semibold text-muted"
      style={{ width: size, height: size }}
    >
      {initialsOf(name, handle)}
    </span>
  )
}

/**
 * Who chose one attribution answer (db/attribution_drilldown.sql): each
 * person with their write-in, and — for "A friend" — who they said referred
 * them. Internal accounts are excluded on the server, like the counts above.
 */
export function AttributionPeople({ source }: { source: string }) {
  const [rows, setRows] = useState<Person[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    void supabase.rpc('attribution_people', { p_source: source }).then(({ data, error }) => {
      if (!alive) return
      if (error) setErr(error.message)
      else setRows((data ?? []) as Person[])
    })
    return () => {
      alive = false
    }
  }, [source])

  if (err) return <p className="px-1 py-2 text-[12px] text-danger">{err}</p>
  if (!rows) return <Loader2 className="mx-auto my-3 size-4 animate-spin text-accent" aria-label="Loading" />
  if (rows.length === 0) return <p className="px-1 py-2 text-[12px] text-subtle">Nobody yet.</p>

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-canvas/40">
      {rows.map((p) => (
        <li key={p.user_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
          <Face src={p.avatar_url} name={p.name} handle={p.handle} />
          <span className="min-w-0 flex-1 basis-40">
            <span className="block truncate text-[13px] font-medium text-fg">{p.name || 'No name yet'}</span>
            <span className="block truncate text-[11.5px] text-subtle">
              {p.handle ? `@${p.handle}` : 'no handle'}
              {p.email ? ` · ${p.email}` : ''} · joined {new Date(p.joined_at).toLocaleDateString()}
            </span>
          </span>
          {p.detail && (
            <span className="rounded-md bg-surface-2 px-2 py-1 text-[12px] text-muted">“{p.detail}”</span>
          )}
          {p.referrer_handle && (
            <span className="flex items-center gap-1.5 rounded-md bg-accent-soft px-2 py-1 text-[12px] text-fg">
              <UserRound size={12} className="text-accent" aria-hidden />
              referred by
              <Face src={p.referrer_avatar} name={p.referrer_name} handle={p.referrer_handle} size={18} />
              <span className="font-medium">{p.referrer_name || `@${p.referrer_handle}`}</span>
              {p.referrer_name && <span className="text-subtle">@{p.referrer_handle}</span>}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
