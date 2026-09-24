import { Link } from 'react-router-dom'
import { Panel } from '../admin-ui'
import type { ParseOverview } from './parse-data'
import { ago, pathLabel, pct } from './format'

/** Why parses fail, which road they took, and who and what they were for. */
export function ParseBreakdowns({ data }: { data: ParseOverview }) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Why they fail" sub="All time, grouped (numbers blanked so the same error groups together)">
          {data.top_errors.length === 0 ? (
            <p className="px-4 py-4 text-[13px] text-subtle">No recorded failures.</p>
          ) : (
            <ul>
              {data.top_errors.map((e, i) => (
                <li key={i} className="flex items-start gap-3 border-t border-border/70 px-4 py-2.5 first:border-t-0">
                  <span className="w-7 shrink-0 text-right font-semibold tabular-nums text-fg">{e.n}</span>
                  <span className="min-w-0 flex-1 text-[12.5px] break-words text-muted">{e.error}</span>
                  <span className="shrink-0 text-[11px] text-subtle">{ago(e.last_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="How the file was read" sub={`Last ${data.window.days} days`}>
          <ul>
            {data.paths.map((p) => (
              <li key={p.path} className="flex items-center gap-3 border-t border-border/70 px-4 py-2.5 first:border-t-0">
                <span className="min-w-0 flex-1 text-[13px] text-fg">{pathLabel(p.path)}</span>
                <span className="text-[12px] tabular-nums text-muted">{p.n}</span>
                <span className="w-16 text-right text-[12px] tabular-nums text-subtle">{pct(p.ok, p.n)} ok</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-border/70 px-4 py-2 text-[11px] text-subtle">
            “Extracted text” is the fast path; a scanned PDF has no text and goes to the model whole.
          </p>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="By student" sub="Most recent first">
          <Table
            head={['Student', 'Parses', 'OK', 'Failed', 'Last']}
            rows={data.by_user.map((u) => [
              <Link key="u" to={`?tab=users&user=${u.user_id}`} className="font-medium text-fg hover:underline">
                {u.name || (u.handle ? `@${u.handle}` : u.email || 'Unknown')}
              </Link>,
              u.total,
              u.ok,
              <span key="f" className={u.failed ? 'text-danger' : undefined}>{u.failed}</span>,
              ago(u.last_at),
            ])}
          />
        </Panel>
        <Panel title="By course" sub="Course code the parser read">
          <Table
            head={['Course', 'Parses', 'OK', 'Failed']}
            rows={data.by_course.map((c) => [
              <span key="c" className="font-medium text-fg">{c.course}</span>,
              c.total,
              c.ok,
              <span key="f" className={c.failed ? 'text-danger' : undefined}>{c.failed}</span>,
            ])}
            empty="Course codes are recorded from now on."
          />
        </Panel>
      </div>
    </>
  )
}

function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty?: string }) {
  if (rows.length === 0) return <p className="px-4 py-4 text-[13px] text-subtle">{empty ?? 'Nothing yet.'}</p>
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-[12.5px]">
        <thead className="sticky top-0 bg-surface text-left text-[11px] tracking-wide text-subtle uppercase">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={i === 0 ? 'px-4 py-2 font-medium' : 'px-3 py-2 text-right font-medium'}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border/70">
              {r.map((c, j) => (
                <td key={j} className={j === 0 ? 'max-w-0 truncate px-4 py-2' : 'px-3 py-2 text-right tabular-nums text-muted'}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
