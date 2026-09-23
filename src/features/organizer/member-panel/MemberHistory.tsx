import { useEffect, useState } from 'react'
import { Loader2, Undo2 } from 'lucide-react'
import { loadMemberActivity, type MemberAction } from '@/lib/org-roles'

const PAGE = 5
const WHEN = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/**
 * The last few things this person did, five at a time.
 *
 * Read through `org_member_activity`, which applies the SAME gate as the
 * Activity tab — a role that cannot read the log cannot read it one person at
 * a time either — and the refusal is said out loud rather than shown as an
 * empty list, which would read as "they have done nothing".
 */
export function MemberHistory({ orgId, userId }: { orgId: string; userId: string }) {
  const [rows, setRows] = useState<MemberAction[] | null>(null)
  const [more, setMore] = useState(false)
  const [denied, setDenied] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    void loadMemberActivity(orgId, userId, PAGE, 0)
      .then((r) => {
        if (!alive) return
        setRows(r)
        setMore(r.length === PAGE)
      })
      .catch(() => alive && setDenied(true))
    return () => {
      alive = false
    }
  }, [orgId, userId])

  function loadMore() {
    if (!rows) return
    setBusy(true)
    void loadMemberActivity(orgId, userId, PAGE, rows.length)
      .then((r) => {
        setRows([...rows, ...r])
        setMore(r.length === PAGE)
      })
      .catch(() => setMore(false))
      .finally(() => setBusy(false))
  }

  if (denied) {
    return <p className="text-[13px] text-subtle">Your role can't see the activity log.</p>
  }
  if (!rows) {
    return <Loader2 size={16} className="animate-spin text-subtle" aria-label="Loading" />
  }
  if (rows.length === 0) {
    return <p className="text-[13px] text-subtle">Nothing recorded yet.</p>
  }

  return (
    <>
      <ol className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {rows.map((a) => (
          <li key={a.id} className="px-3.5 py-2.5">
            <p className="text-[13px] text-fg">
              {a.action}
              {a.detail && <span className="text-subtle"> · {a.detail}</span>}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-subtle">
              {WHEN.format(new Date(a.createdAt))}
              {a.revertedAt && (
                <span className="inline-flex items-center gap-1 text-warning">
                  <Undo2 size={11} aria-hidden />
                  undone
                </span>
              )}
            </p>
          </li>
        ))}
      </ol>
      {more && (
        <button
          type="button"
          onClick={loadMore}
          disabled={busy}
          className="mt-2 w-full rounded-lg border border-border py-2 text-[12.5px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-50"
        >
          {busy ? 'Loading…' : 'Load more'}
        </button>
      )}
    </>
  )
}
