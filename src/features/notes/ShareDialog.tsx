import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Link2, UserPlus, X } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { PersonAvatar } from '@/features/community/PersonAvatar'
import { searchPeople, type PublicPerson } from '@/features/community/profile-follows'
import { listShares, removeShare, setShareLink, setShareRole, shareLinkUrl, shareWith, type ShareEntry, type ShareKind, type ShareRole } from './sharing-api'

const ROLES = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'editor', label: 'Editor' },
]

/**
 * Share a note or a folder (a class included): add people from the site as
 * viewers or editors, or turn on a link. Sharing a folder shares everything in
 * it, including folders inside it — said in the dialog, because that is the
 * one thing about sharing a person could get wrong.
 */
export function ShareDialog({ kind, id, name, onClose }: { kind: ShareKind; id: string; name: string; onClose: () => void }) {
  const [entries, setEntries] = useState<ShareEntry[] | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PublicPerson[]>([])
  const [role, setRole] = useState<ShareRole>('viewer')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(() => {
    listShares(kind, id)
      .then(setEntries)
      .catch(() => setEntries([]))
  }, [kind, id])
  useEffect(load, [load])

  useEffect(() => {
    const q = query.trim().replace(/^@/, '')
    if (q.length < 2) return
    const t = setTimeout(() => void searchPeople(q, 6).then(setResults), 200)
    return () => clearTimeout(t)
  }, [query])

  const add = async (handle: string) => {
    setError(null)
    const err = await shareWith(kind, id, handle, role)
    if (err) return setError(err)
    setQuery('')
    setResults([])
    load()
  }

  const link = entries?.find((e) => e.linkToken)
  const people = entries?.filter((e) => e.userId) ?? []

  const copy = async () => {
    if (!link?.linkToken) return
    try {
      await navigator.clipboard.writeText(shareLinkUrl(link.linkToken))
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* the link is visible and selectable below */
    }
  }

  return (
    <ModalShell label={`Share ${name}`} onClose={onClose} widthClass="sm:max-w-lg">
      <div className="flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-[17px] font-semibold text-fg">Share “{name}”</h2>
          {kind === 'folder' && (
            <p className="mt-0.5 text-[12.5px] text-muted">Everything in this folder is shared, including folders inside it.</p>
          )}
        </div>

        <div className="relative">
          <div className="flex gap-2">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 focus-within:border-accent">
              <UserPlus size={15} className="shrink-0 text-subtle" aria-hidden />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  if (e.target.value.trim().length < 2) setResults([])
                }}
                onKeyDown={(e) => {
                  // An exact @handle shares on Enter, even for someone search
                  // does not list; the database checks the handle exists.
                  const h = query.trim().replace(/^@/, '')
                  if (e.key === 'Enter' && /^[a-z0-9_.]{2,30}$/i.test(h)) {
                    e.preventDefault()
                    void add(h)
                  }
                }}
                placeholder="Add people by name or @handle, then Enter"
                aria-label="Add people"
                className="min-w-0 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-subtle"
              />
            </label>
            <Select size="md" tone="control" ariaLabel="Role for new people" value={role} onChange={(v) => setRole(v as ShareRole)} options={ROLES} className="w-28" />
          </div>
          {results.length > 0 && query.trim().length >= 2 && (
            <ul className="ct-animate-pop absolute inset-x-0 top-12 z-10 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-xl">
              {results.map((p) => (
                <li key={p.handle}>
                  <button type="button" onClick={() => void add(p.handle)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-2">
                    <PersonAvatar person={p} className="size-7" />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-fg">{p.name || p.handle}</span>
                    <span className="text-[12px] text-subtle">@{p.handle}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="mt-1.5 text-[12.5px] text-danger">{error}</p>}
        </div>

        <div>
          <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-subtle uppercase">People with access</p>
          {entries === null ? (
            <div className="ct-shimmer h-10 rounded-lg" />
          ) : people.length === 0 ? (
            <p className="text-[13px] text-muted">Only you, so far.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {people.map((p) => (
                <li key={p.shareId} className="flex items-center gap-2.5 rounded-lg px-1 py-1">
                  <PersonAvatar person={{ handle: p.handle ?? '', name: p.name, avatar_url: p.avatarUrl }} className="size-8" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] text-fg">{p.name || `@${p.handle}`}</span>
                    <span className="block text-[11.5px] text-subtle">{p.viaLink ? 'Joined by link' : `@${p.handle}`}</span>
                  </span>
                  <Select size="sm" tone="control" ariaLabel={`Role for ${p.name ?? p.handle}`} value={p.role} options={ROLES}
                    onChange={(v) => void setShareRole(p.shareId, v as ShareRole).then(load)} className="w-24" />
                  <button type="button" aria-label={`Remove ${p.name ?? p.handle}`} onClick={() => void removeShare(p.shareId).then(load)}
                    className="grid size-8 place-items-center rounded-lg text-subtle hover:bg-surface-2 hover:text-danger">
                    <X size={15} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border p-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-surface-2 text-muted">
              <Link2 size={16} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-medium text-fg">Share by link</span>
              <span className="block text-[12px] text-subtle">
                {link ? 'Anyone signed in with the link joins as ' + (link.role === 'editor' ? 'an editor.' : 'a viewer.') : 'Off. Only the people above have access.'}
              </span>
            </span>
            <Select size="sm" tone="control" ariaLabel="Link access" value={link ? link.role : 'off'}
              options={[{ value: 'off', label: 'Off' }, ...ROLES]}
              onChange={(v) => void setShareLink(kind, id, v === 'off' ? null : (v as ShareRole)).then(load)} className="w-24" />
          </div>
          {link?.linkToken && (
            <div className="mt-2.5 flex gap-2">
              <input readOnly value={shareLinkUrl(link.linkToken)} aria-label="Share link" onFocus={(e) => e.currentTarget.select()}
                className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-2.5 text-[12.5px] text-muted outline-none" />
              <Button size="sm" variant="outline" onClick={() => void copy()}>
                {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  )
}
