import { useCallback, useState } from 'react'
import { CheckCircle2, Loader2, Lock } from 'lucide-react'
import { fmtDate, listKnownIssues, submitBug, useList, type KnownIssue } from './feedback-data'
import { KnownIssueChip } from './feedback-ui'
import { useAuth } from '@/app/providers/auth'
import { Button } from '@/components/ui/Button'

export function BugChannel() {
  const knownLoader = useCallback(() => listKnownIssues(), [])
  const { items, loading } = useList<KnownIssue>(knownLoader)

  return (
    <div className="space-y-6">
      <BugForm />

      <section>
        <h2 className="mb-1 text-[14px] font-semibold text-fg">Recently fixed &amp; known issues</h2>
        <p className="mb-3 text-[12px] text-subtle">A curated list — not a public complaint feed.</p>
        {loading ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="size-5 animate-spin text-accent" aria-label="Loading" />
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-[13px] text-subtle">
            Nothing to report right now — all clear.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((b) => (
              <li key={b.id} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3.5">
                <KnownIssueChip status={b.status} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-fg">{b.title}</p>
                  {b.description && <p className="mt-0.5 text-[12px] text-muted">{b.description}</p>}
                  <p className="mt-1 text-[11px] text-subtle">{fmtDate(b.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function BugForm() {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [page, setPage] = useState('')
  const [device, setDevice] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async () => {
    if (title.trim().length < 3) {
      setErr('Add a short title describing the bug.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await submitBug({
        title,
        description: [desc.trim(), device.trim() && `Device/browser: ${device.trim()}`].filter(Boolean).join('\n\n'),
        page,
        userId: user?.id ?? null,
        userEmail: user?.email ?? null,
      })
      setDone(true)
      setTitle('')
      setDesc('')
      setPage('')
      setDevice('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not submit')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-success/40 bg-success/10 p-4">
        <div className="flex items-center gap-2 text-[14px] font-medium text-success">
          <CheckCircle2 size={18} aria-hidden /> Thanks — we got it.
        </div>
        <p className="mt-1 text-[12px] text-muted">Your report is private; only the team sees it.</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => setDone(false)}>
          Report another
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
        <Lock size={14} className="text-subtle" aria-hidden /> Report a bug — privately
      </div>
      <p className="mt-0.5 text-[12px] text-subtle">Only the team sees this. You won't see others' reports.</p>

      <div className="mt-3 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's broken? (short title)"
          maxLength={120}
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
        />
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="What happened? Steps to reproduce, what you expected…"
          className="w-full resize-y rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={page}
            onChange={(e) => setPage(e.target.value)}
            placeholder="Where? (e.g. Calendar, a course)"
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          <input
            value={device}
            onChange={(e) => setDevice(e.target.value)}
            placeholder="Device + browser"
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        {err ? <p className="text-[12px] text-danger">{err}</p> : <span />}
        <Button size="sm" disabled={busy} onClick={submit}>
          {busy ? 'Sending…' : 'Submit privately'}
        </Button>
      </div>
    </div>
  )
}
