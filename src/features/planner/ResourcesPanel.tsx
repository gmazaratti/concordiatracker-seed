import { useMemo, useState } from 'react'
import { CalendarCheck, ExternalLink, Mail, MapPin, Phone, Search, Star, Users } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { facultyKey, RESOURCE_GROUPS, type Resource } from '@/data/resources'
import { cn } from '@/lib/cn'

/**
 * Who to contact at Concordia, for what (data/resources.ts). Your own
 * faculty's advising office is pinned first. Every card links the official
 * page it came from, since contact details change.
 */
export function ResourcesPanel() {
  const { user } = useAppData()
  const [q, setQ] = useState('')
  const mine = facultyKey(`${user.school ?? ''} ${user.program ?? ''}`)
  const query = q.trim().toLowerCase()

  const groups = useMemo(
    () =>
      RESOURCE_GROUPS.map((g) => ({
        ...g,
        items: g.items
          .filter((r) => !query || `${r.name} ${r.what}`.toLowerCase().includes(query))
          .sort((a, b) => Number(b.faculty === mine && !!mine) - Number(a.faculty === mine && !!mine)),
      })).filter((g) => g.items.length > 0),
    [query, mine],
  )

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-fg">Resources</h2>
      <p className="mt-0.5 text-[12.5px] text-subtle">
        Advisors, registration, tutoring, health and more: who to contact at Concordia, and how.
      </p>
      <label className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 focus-within:border-accent">
        <Search size={15} className="text-subtle" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search: advising, writing, fees, mental health…"
          aria-label="Search resources"
          className="min-w-0 flex-1 bg-transparent text-[16px] text-fg outline-none placeholder:text-subtle sm:text-[13.5px]"
        />
      </label>

      {groups.length === 0 && <p className="mt-6 text-center text-[13px] text-subtle">Nothing matches that.</p>}
      {groups.map((g) => (
        <section key={g.id} className="mt-6">
          <h3 className="mb-2 text-[11.5px] font-semibold tracking-wide text-subtle uppercase">{g.title}</h3>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {g.items.map((r) => (
              <Card key={r.name} r={r} yours={!!mine && r.faculty === mine} />
            ))}
          </div>
        </section>
      ))}
      <p className="mt-6 text-[11.5px] text-subtle">
        Copied from concordia.ca in November 2026. Offices move and numbers change, so each card links its official page.
      </p>
    </div>
  )
}

function Card({ r, yours }: { r: Resource; yours: boolean }) {
  return (
    <article className={cn('rounded-xl border bg-surface p-3.5', yours ? 'border-accent/50' : 'border-border')}>
      <div className="flex items-start gap-2">
        <h4 className="min-w-0 flex-1 text-[13.5px] font-semibold text-fg">{r.name}</h4>
        {yours && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
            <Star size={10} aria-hidden /> Your faculty
          </span>
        )}
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{r.what}</p>
      <ul className="mt-2 space-y-1 text-[12.5px]">
        {r.email && (
          <li className="flex items-center gap-1.5">
            <Mail size={13} className="shrink-0 text-subtle" aria-hidden />
            <span className="min-w-0 truncate text-fg select-all">{r.email}</span>
          </li>
        )}
        {r.phone && (
          <li className="flex items-center gap-1.5 text-fg">
            <Phone size={13} className="shrink-0 text-subtle" aria-hidden /> {r.phone}
          </li>
        )}
        {r.where && (
          <li className="flex items-start gap-1.5 text-muted">
            <MapPin size={13} className="mt-0.5 shrink-0 text-subtle" aria-hidden /> {r.where}
          </li>
        )}
        {r.hours && <li className="pl-5 text-[11.5px] text-subtle">{r.hours}</li>}
      </ul>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <a href={r.url} target="_blank" rel="noreferrer noopener" className={chip}>
          Official page <ExternalLink size={11} aria-hidden />
        </a>
        {r.listUrl && (
          <a href={r.listUrl} target="_blank" rel="noreferrer noopener" className={chip}>
            <Users size={11} aria-hidden /> Advisors and emails
          </a>
        )}
        {r.bookUrl && (
          <a href={r.bookUrl} target="_blank" rel="noreferrer noopener" className={chip}>
            <CalendarCheck size={11} aria-hidden /> Book
          </a>
        )}
      </div>
    </article>
  )
}

const chip =
  'inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11.5px] font-medium text-muted hover:border-accent hover:text-fg'
