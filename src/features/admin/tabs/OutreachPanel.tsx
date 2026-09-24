import { useCallback, useState } from 'react'
import { Check, Plus, Send } from 'lucide-react'
import {
  adminAddOutreach,
  adminDeleteOutreach,
  adminListOutreach,
  adminMarkOutreachSent,
  useAdminList,
  type OutreachLink,
} from '../admin-data'
import { outreachUrl } from './outreach-url'
import { ConfirmButton, CopyChip, EmptyState, ErrorState, Loading, Panel, Pill, RefreshButton } from '../admin-ui'

/**
 * Outreach links — sent, opened, converted.
 *
 * THE REGISTRY IS THE POINT. `site_events` already measures anything that gets
 * clicked; what it cannot show is a link nobody opened, because an unopened
 * link leaves no rows. Listing what went out turns silence into a number:
 * "sent 9 days ago, never opened" is the single most useful row on this
 * screen and it does not exist without this table.
 *
 * "Unique" is unique BROWSER. The underlying id is a random string a browser
 * generated for itself — no IP, no user agent, no fingerprint — so one person
 * on a phone and a laptop is two. The column says so rather than implying we
 * counted people.
 */
export function OutreachPanel() {
  const loader = useCallback(() => adminListOutreach(), [])
  const links = useAdminList<OutreachLink>(loader)
  const [adding, setAdding] = useState(false)
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      links.reload()
    } finally {
      setBusy(false)
    }
  }

  const add = () =>
    run(async () => {
      await adminAddOutreach(code.trim(), label.trim() || code.trim(), '/organizer')
      setCode('')
      setLabel('')
      setAdding(false)
    })

  const sent = links.items.filter((l) => l.sent_at)
  const opened = sent.filter((l) => l.unique_opens > 0).length
  const converted = sent.filter((l) => l.signed_up).length

  return (
    <Panel
      title="Outreach links"
      sub={
        sent.length > 0
          ? `${sent.length} sent · ${opened} opened · ${converted} signed up`
          : 'One link per club. Mark it sent when it goes out.'
      }
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:text-fg"
          >
            <Plus size={13} aria-hidden />
            New link
          </button>
          <RefreshButton onClick={links.reload} busy={links.loading} />
        </div>
      }
    >
      {adding && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-canvas p-2.5">
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Who it's for (HackConcordia)"
            className="min-w-[180px] flex-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
            placeholder="code (hackconcordia)"
            className="min-w-[150px] rounded-lg border border-border bg-surface px-2.5 py-1.5 font-mono text-[12.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            disabled={code.trim().length < 2 || busy}
            onClick={add}
            className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-50"
          >
            Create
          </button>
        </div>
      )}

      {links.loading ? (
        <Loading />
      ) : links.error ? (
        <ErrorState message={links.error} />
      ) : links.items.length === 0 ? (
        <EmptyState>
          No links yet. Make one per club so you can tell "ignored" from "never sent".
        </EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {links.items.map((l) => (
            <Row key={l.code} link={l} busy={busy} run={run} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

function Row({
  link: l,
  busy,
  run,
}: {
  link: OutreachLink
  busy: boolean
  run: (fn: () => Promise<void>) => Promise<void>
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
      <div className="min-w-[160px] flex-1">
        <p className="flex items-center gap-2 text-[13px] font-medium text-fg">
          {l.label}
          {l.signed_up ? (
            <Pill tone={l.org_status === 'approved' ? 'green' : 'amber'}>
              {l.org_status === 'approved' ? 'live' : 'signed up'}
            </Pill>
          ) : l.unique_opens > 0 ? (
            <Pill tone="neutral">opened</Pill>
          ) : l.sent_at ? (
            <Pill tone="amber">no opens</Pill>
          ) : (
            <Pill tone="neutral">not sent</Pill>
          )}
        </p>
        <p className="mt-0.5 text-[11.5px] text-subtle">
          {l.sent_at
            ? `Sent ${l.days_out === 0 ? 'today' : `${l.days_out}d ago`}`
            : 'Not sent yet'}
          {l.signed_up && l.org_handle ? ` · ${l.org_handle}` : ''}
        </p>
      </div>

      {/* Opens, then unique. Both, because one person refreshing is not
          interest and the gap between the two is how you tell. */}
      <div className="flex items-center gap-4 text-[12px] tabular-nums">
        <span className="text-muted" title="Total opens since it was sent">
          {l.opens} <span className="text-subtle">opens</span>
        </span>
        <span className="text-muted" title="Distinct browsers, not people. One person on a phone and a laptop counts twice">
          {l.unique_opens} <span className="text-subtle">unique</span>
        </span>
      </div>

      {/* The link TRUNCATES inside its chip rather than setting the row's
          width: a flex item's minimum is its content, so a long URL used to
          push the whole row past the panel. */}
      <div className="flex w-full min-w-0 items-center gap-1.5 sm:w-auto sm:max-w-[340px]">
        <span className="min-w-0 flex-1">
          <CopyChip value={outreachUrl(l)} title="Copy the link" />
        </span>
        {!l.sent_at ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => adminMarkOutreachSent(l.code, true))}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[12px] text-muted transition-colors duration-150 hover:text-fg"
          >
            <Send size={12} aria-hidden />
            Mark sent
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 px-1 text-[12px] text-subtle">
            <Check size={12} aria-hidden />
          </span>
        )}
        <ConfirmButton onConfirm={() => void run(() => adminDeleteOutreach(l.code))} label="Delete" />
      </div>
    </li>
  )
}
