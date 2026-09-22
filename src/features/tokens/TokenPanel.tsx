import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { createToken, listTokens, revokeToken, used, type ApiToken, type TokenScope } from './tokens-data'

/**
 * Create and revoke API tokens. One panel, used by Settings (`me`) and the
 * admin console (`owner`) — the two differ in scope and in wording, not in
 * behaviour, and two copies would drift.
 *
 * THE NEW TOKEN IS SHOWN ONCE, LOUDLY. It genuinely cannot be retrieved
 * again — nothing stores it — so a panel that displayed it quietly alongside
 * everything else would be setting people up to lose it. It gets its own
 * block, a copy button, and a sentence saying this is the only time.
 */
export function TokenPanel({ scope }: { scope: TokenScope }) {
  const [rows, setRows] = useState<ApiToken[] | null>(null)
  const [err, setErr] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [fresh, setFresh] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)

  const [reloads, setReloads] = useState(0)
  const reload = useCallback(() => setReloads((n) => n + 1), [])

  useEffect(() => {
    let alive = true
    listTokens()
      .then((t) => alive && setRows(t))
      .catch((e: unknown) => {
        if (!alive) return
        // An empty list and a failed load are different facts, and a panel
        // that shows "no tokens yet" for a broken query is the ticket bug
        // again.
        setErr(e instanceof Error ? e.message : 'Could not load your tokens.')
        setRows([])
      })
    return () => {
      alive = false
    }
  }, [reloads])

  const mine = (rows ?? []).filter((t) => t.scope === scope)
  const active = mine.filter((t) => !t.revoked_at)

  async function make() {
    if (!name.trim() || busy) return
    setBusy(true)
    setErr('')
    try {
      setFresh(await createToken(name.trim(), scope))
      setName('')
      setCopied(false)
      reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create that token.')
    } finally {
      setBusy(false)
    }
  }

  async function drop(id: string) {
    setErr('')
    try {
      await revokeToken(id)
      reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not revoke that token.')
    } finally {
      setConfirming(null)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] leading-relaxed text-subtle">
        {scope === 'admin' ? (
          <>
            The widest key this system issues. It reaches everything the admin console shows
            through <code className="rounded bg-surface-2 px-1">/api/v1/admin</code>, and manages
            student organisations through{' '}
            <code className="rounded bg-surface-2 px-1">/api/v1/orgs</code> — profiles, images,
            events, posts, stories and invites. Publishing still needs the account to be on that
            organisation&rsquo;s team, and deleting an org or a teammate is not reachable at all.
            Every write it makes is recorded in the audit log.
          </>
        ) : scope === 'support' ? (
          <>
            A key for an assistant working the support desk through{' '}
            <code className="rounded bg-surface-2 px-1">/api/v1/support</code>. It can read
            threads, draft replies and hand a conversation back — and the database refuses it any
            thread you have taken over, resolved, or that the customer asked a person for.
          </>
        ) : scope === 'owner' ? (
          <>
            A token for reading business statistics from{' '}
            <code className="rounded bg-surface-2 px-1">/api/v1/owner</code> — a dashboard, a
            script, or an agent. It returns counts and revenue only, never anybody&rsquo;s name or
            email.
          </>
        ) : (
          <>
            A token lets your own scripts read your courses, deadlines and GPA from{' '}
            <code className="rounded bg-surface-2 px-1">/api/v1/me</code>, and tick things off. It
            can only ever see your account.
          </>
        )}
      </p>

      {/* The one time it exists. */}
      {fresh && (
        <div className="rounded-lg border border-accent/50 bg-accent-soft/30 p-3">
          <p className="text-[12.5px] font-medium text-fg">
            Copy this now — it is not shown again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-canvas px-2.5 py-2 font-mono text-[12px] text-fg">
              {fresh}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(fresh).then(() => setCopied(true))
              }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-2.5 py-2 text-[12px] font-medium text-accent-contrast transition-opacity hover:opacity-90"
            >
              {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setFresh(null)}
            className="mt-2 text-[11.5px] text-subtle transition-colors hover:text-fg"
          >
            I have saved it
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void make()}
          maxLength={60}
          placeholder={
            scope === 'admin'
              ? 'Whose agent is it? e.g. Alfred'
              : scope === 'support'
                ? 'Whose assistant is it? e.g. Alfred'
                : scope === 'owner'
                  ? 'What is it for? e.g. Grafana'
                  : 'e.g. my laptop script'
          }
          aria-label="Token name"
          className="min-w-0 flex-1 rounded-md border border-border bg-canvas px-2.5 py-1.5 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
        />
        <Button size="sm" disabled={busy || !name.trim()} onClick={() => void make()}>
          {busy ? (
            <Loader2 size={13} className="mr-1 inline animate-spin" aria-hidden />
          ) : (
            <Plus size={13} className="mr-1 inline" aria-hidden />
          )}
          Create
        </Button>
      </div>
      {err && <p className="text-[12px] text-danger">{err}</p>}

      {rows === null ? (
        <p className="flex items-center gap-2 py-2 text-[12.5px] text-subtle">
          <Loader2 size={13} className="animate-spin" aria-hidden />
          Loading
        </p>
      ) : mine.length === 0 ? (
        <p className="py-2 text-[12.5px] text-subtle">No tokens yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {mine.map((t) => (
            <li key={t.id} className="flex items-center gap-2.5 px-3 py-2.5">
              <KeyRound
                size={14}
                className={cn('shrink-0', t.revoked_at ? 'text-subtle' : 'text-accent')}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'truncate text-[12.5px] font-medium',
                    t.revoked_at ? 'text-subtle line-through' : 'text-fg',
                  )}
                >
                  {t.name}
                </p>
                <p className="truncate font-mono text-[11px] text-subtle">
                  {t.prefix}… · {t.revoked_at ? 'revoked' : used(t.last_used_at)}
                  {t.use_count > 0 && ` · ${t.use_count} calls`}
                </p>
              </div>
              {!t.revoked_at &&
                (confirming === t.id ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void drop(t.id)}
                      className="rounded-md bg-danger px-2 py-1 text-[11.5px] font-medium text-white"
                    >
                      Revoke
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="text-[11.5px] text-subtle hover:text-fg"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(t.id)}
                    aria-label={`Revoke ${t.name}`}
                    className="shrink-0 rounded-md p-1.5 text-subtle transition-colors hover:bg-surface-2 hover:text-danger"
                  >
                    <Trash2 size={13} aria-hidden />
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11.5px] text-subtle">
        {active.length} active · revoking takes effect immediately · 120 requests a minute each.{' '}
        <a href="/docs/api" className="underline hover:text-fg">
          How to use them
        </a>
      </p>
    </div>
  )
}
