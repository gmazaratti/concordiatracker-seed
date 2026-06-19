import { useCallback, useState } from 'react'
import { Link2, TrendingUp } from 'lucide-react'
import { adminListUsers, adminSetVanity, useAdminList, type AdminUser } from '../admin-data'
import { CopyChip, EmptyState, ErrorState, Loading, Panel, RefreshButton, SearchBar } from '../admin-ui'
import { Button } from '@/components/ui/Button'

const origin = typeof window !== 'undefined' ? window.location.origin : 'https://concordiatracker.com'

export function VanityTab() {
  const loader = useCallback(() => adminListUsers(), [])
  const { items, loading, error, reload } = useAdminList<AdminUser>(loader)
  const [q, setQ] = useState('')

  const needle = q.trim().toLowerCase()
  const filtered = items.filter(
    (u) =>
      !needle ||
      (u.name ?? '').toLowerCase().includes(needle) ||
      (u.email ?? '').toLowerCase().includes(needle) ||
      (u.vanity_code ?? '').toLowerCase().includes(needle),
  )
  const totalAttributed = items.reduce((s, u) => s + u.signups_attributed, 0)

  return (
    <div className="space-y-4">
      <SearchBar value={q} onChange={setQ} placeholder="Search by name, email, or code…">
        <RefreshButton onClick={reload} busy={loading} />
      </SearchBar>

      <Panel
        title="Vanity codes"
        sub={loading ? 'Loading…' : `${filtered.length} users · ${totalAttributed} attributed signups`}
      >
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} />
        ) : filtered.length === 0 ? (
          <EmptyState>No users match.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((u) => (
              <VanityRow key={u.user_id} u={u} onChanged={reload} />
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Active site links" sub="Public link patterns in this build">
        <ul className="divide-y divide-border text-[12px]">
          <LinkRow label="Vanity referral" example={`${origin}/?ref=CODE`} note="Attributes a signup to that user's code" />
          <LinkRow label="Public event" example={`${origin}/e/:eventId`} note="Shareable, no account needed" />
          <LinkRow label="Org profile" example={`${origin}/community/org/:handle`} note="Public organizer page" />
        </ul>
      </Panel>
    </div>
  )
}

function LinkRow({ label, example, note }: { label: string; example: string; note: string }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
      <span className="w-28 shrink-0 font-medium text-fg">{label}</span>
      <code className="rounded bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-muted">{example}</code>
      <span className="text-subtle">{note}</span>
    </li>
  )
}

function VanityRow({ u, onChanged }: { u: AdminUser; onChanged: () => void }) {
  const [code, setCode] = useState(u.vanity_code ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const dirty = code.trim().toUpperCase() !== (u.vanity_code ?? '')

  const save = async () => {
    setBusy(true)
    setErr(null)
    try {
      await adminSetVanity(u.user_id, code.trim().toUpperCase())
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace('code already taken', 'That code is already taken') : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const refLink = u.vanity_code ? `${origin}/?ref=${u.vanity_code}` : null

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <span className="truncate text-[13px] font-medium text-fg">{u.name || 'Unnamed'}</span>
        <span className="ml-2 text-[12px] text-subtle">{u.email}</span>
        {refLink && (
          <div className="mt-1.5">
            <CopyChip value={refLink} title="Copy referral link" />
          </div>
        )}
        {err && <div className="mt-1 text-[12px] text-danger">{err}</div>}
      </div>

      <span className="inline-flex items-center gap-1 text-[12px] text-subtle" title="Signups attributed">
        <TrendingUp size={13} aria-hidden />
        {u.signups_attributed}
      </span>

      <div className="flex items-center gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          aria-label="Vanity code"
          spellCheck={false}
          maxLength={20}
          className="w-32 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-[12px] tracking-wider text-fg uppercase focus:border-accent focus:outline-none"
        />
        <Button size="sm" disabled={busy || !dirty || code.trim().length < 3} onClick={save}>
          <Link2 size={13} aria-hidden />
          Set
        </Button>
      </div>
    </li>
  )
}
