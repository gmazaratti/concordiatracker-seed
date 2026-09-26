import { useEffect, useState } from 'react'
import { Check, Copy, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  createAssistantToken,
  listAssistantTokens,
  revokeAssistantToken,
  type AssistantToken,
} from './assistant-data'

/**
 * Assistant tokens (`ct_ast_…`). Issued to the assistant identity
 * (alfred@concordiatracker.com), not to you: that is the account the API acts
 * as, and the only one db/assistant_grant.sql grants anything to. The token is
 * shown once; only its hash is kept.
 */
export function AssistantTokens() {
  const [rows, setRows] = useState<AssistantToken[] | null>(null)
  const [err, setErr] = useState('')
  const [name, setName] = useState('Alfred')
  const [fresh, setFresh] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [armed, setArmed] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    listAssistantTokens().then(
      (t) => alive && setRows(t),
      (e: unknown) => alive && setErr(e instanceof Error ? e.message : 'Could not load assistant tokens.'),
    )
    return () => {
      alive = false
    }
  }, [tick])

  async function mint() {
    setErr('')
    try {
      setFresh(await createAssistantToken(name))
      setCopied(false)
      setTick((n) => n + 1)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create the token.')
    }
  }

  async function revoke(id: string) {
    if (armed !== id) return setArmed(id)
    setArmed(null)
    try {
      await revokeAssistantToken(id)
    } finally {
      setTick((n) => n + 1)
    }
  }

  const active = rows?.filter((r) => !r.revoked_at) ?? []

  return (
    <div>
      <p className="flex items-center gap-2 text-[13px] font-semibold text-fg">
        <KeyRound size={15} aria-hidden />
        Assistant token (ct_ast_)
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-subtle">
        Lets the assistant act on any club without being on its team: stories, posts, events, the
        profile, team invites and insights. Not the handle, roles, ownership, handoff links or the club
        inbox. Every write it makes is in Assistant activity below.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Token name"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-[13px] text-fg focus:border-accent focus:outline-none sm:max-w-[14rem]"
        />
        <Button size="sm" onClick={() => void mint()}>
          Create assistant token
        </Button>
      </div>
      {err && <p className="mt-2 text-[12px] text-danger">{err}</p>}

      {fresh && (
        <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
          <p className="text-[12px] font-medium text-warning">Copy it now. It will not be shown again.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-surface-2 px-2 py-1 text-[12px] text-fg">{fresh}</code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(fresh)
                setCopied(true)
              }}
              aria-label="Copy token"
              className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted hover:text-fg"
            >
              {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
            </button>
          </div>
        </div>
      )}

      <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
        {rows === null ? (
          <li className="px-3 py-2.5 text-[12px] text-subtle">Loading…</li>
        ) : active.length === 0 ? (
          <li className="px-3 py-2.5 text-[12px] text-subtle">No active assistant tokens.</li>
        ) : (
          active.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-fg">
                  {t.name} <span className="font-normal text-subtle">{t.prefix}…</span>
                </span>
                <span className="block text-[11.5px] text-subtle">
                  {t.last_used_at ? `Used ${t.use_count} times, last ${new Date(t.last_used_at).toLocaleString()}` : 'Never used'}
                </span>
              </span>
              <Button size="sm" variant="outline" onClick={() => void revoke(t.id)}>
                {armed === t.id ? 'Confirm revoke' : 'Revoke'}
              </Button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
