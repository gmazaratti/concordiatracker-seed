import { useEffect, useState } from 'react'
import { ExternalLink, Laptop, Lock, Globe2, Smartphone, Tablet } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { describeUserAgent } from '@/lib/devices'
import { when } from './user-detail-data'
import { proSourceLabels, type ProSource } from './pro-sources'

interface Extras {
  profile: {
    handle: string | null
    bio: string | null
    profile_public: boolean
    links: Record<string, unknown>
    dm_policy: string | null
    schedule_visibility: string | null
  } | null
  sessions: { user_agent: string | null; ip: string | null; signed_in: string; last_active: string }[]
  past_devices: { user_agent: string | null; ip: string | null; last_active: string; ended_at: string }[]
  moodle: { status: string | null; connected_at: string; last_sync_at: string | null; event_count: number | null; last_error: string | null } | null
  pro: ProSource | null
}

const DM: Record<string, string> = { everyone: 'Anyone', mutuals: 'Only mutual follows', off: 'Nobody' }

/**
 * Admin → Users → Overview: the profile as they set it, where they are signed
 * in, and their Moodle sync. Read through admin_user_extras
 * (db/admin_user_extras.sql), which never returns the Moodle link itself.
 */
export function UserExtras({ userId }: { userId: string }) {
  const [x, setX] = useState<Extras | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    void supabase.rpc('admin_user_extras', { p_user: userId }).then(({ data, error }) => {
      if (!alive) return
      if (error) setErr(error.message)
      else setX(data as Extras)
    })
    return () => {
      alive = false
    }
  }, [userId])

  if (err) return <p className="text-[12px] text-danger">Could not load profile and devices: {err}</p>
  if (!x) return <p className="text-[12px] text-subtle">Loading profile and devices…</p>

  const p = x.profile
  const links = Object.entries(p?.links ?? {}).filter(([k, v]) => k !== 'titles' && typeof v === 'string' && v)
  const pro = proSourceLabels(x.pro)

  return (
    <div className="space-y-3">
      {/* Profile */}
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[12.5px] font-medium text-fg">
            {p?.profile_public ? <Globe2 size={14} aria-hidden /> : <Lock size={14} aria-hidden />}
            Profile {p?.handle ? `@${p.handle}` : '(no handle yet)'}
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-normal text-muted">
              {p?.profile_public ? 'Public' : 'Private'}
            </span>
          </p>
          {p?.handle && (
            <a
              href={`/@${p.handle}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              Go to profile
              <ExternalLink size={13} aria-hidden />
            </a>
          )}
        </div>
        <p className="mt-2 text-[12.5px] whitespace-pre-wrap text-muted">
          {p?.bio?.trim() ? p.bio : <span className="text-subtle">No bio.</span>}
        </p>
        {links.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {links.map(([k, v]) => (
              <li key={k}>
                <a
                  href={String(v)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11.5px] text-muted hover:text-fg"
                >
                  {k}
                  <ExternalLink size={11} aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        )}
        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-[12px] sm:grid-cols-2">
          <div className="flex justify-between gap-3"><dt className="text-subtle">Who can message</dt><dd className="text-fg">{DM[p?.dm_policy ?? 'everyone'] ?? p?.dm_policy}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-subtle">Schedule visible to</dt><dd className="text-fg">{p?.schedule_visibility ?? 'nobody'}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-subtle">Pro from</dt><dd className="text-fg">{pro.length ? pro.join(' · ') : 'Free'}</dd></div>
        </dl>
      </div>

      {/* Moodle */}
      <div className="rounded-lg border border-border bg-surface p-3 text-[12.5px]">
        <p className="font-medium text-fg">Moodle sync</p>
        {x.moodle ? (
          <dl className="mt-1.5 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
            <div className="flex justify-between gap-3"><dt className="text-subtle">Status</dt><dd className={x.moodle.status === 'error' ? 'text-danger' : 'text-success'}>{x.moodle.status === 'error' ? 'Failing' : 'Working'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-subtle">Connected</dt><dd className="text-fg">{when(x.moodle.connected_at)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-subtle">Last sync</dt><dd className="text-fg">{when(x.moodle.last_sync_at)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-subtle">Deadlines synced</dt><dd className="text-fg">{x.moodle.event_count ?? 0}</dd></div>
            {x.moodle.last_error && <p className="col-span-full text-[11.5px] text-danger">{x.moodle.last_error}</p>}
          </dl>
        ) : (
          <p className="mt-1 text-subtle">Not connected.</p>
        )}
      </div>

      {/* Devices */}
      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="text-[12.5px] font-medium text-fg">Devices</p>
        <DeviceList title="Signed in now" rows={x.sessions.map((s) => ({ ua: s.user_agent, ip: s.ip, at: s.last_active, label: 'Active' }))} empty="No live sessions." />
        <DeviceList title="Signed out (last 90 days)" rows={x.past_devices.map((s) => ({ ua: s.user_agent, ip: s.ip, at: s.last_active, label: 'Last active' }))} empty="None recorded." />
      </div>
    </div>
  )
}

function DeviceList({ title, rows, empty }: { title: string; rows: { ua: string | null; ip: string | null; at: string; label: string }[]; empty: string }) {
  return (
    <div className="mt-2">
      <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-1 text-[12px] text-subtle">{empty}</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {rows.map((r, i) => {
            const d = describeUserAgent(r.ua)
            const Icon = d.kind === 'phone' ? Smartphone : d.kind === 'tablet' ? Tablet : Laptop
            return (
              <li key={i} className="flex items-center gap-2 text-[12px]">
                <Icon size={14} className="shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-fg">{d.browser} on {d.os}</span>
                <span className="shrink-0 text-subtle">{r.label} {when(r.at)}{r.ip ? ` · ${r.ip}` : ''}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
