/**
 * The Monday "your week ahead" email (db/email_prefs.sql).
 *
 * Runs inside the reminders cron. `claim_weekly_digests()` only returns people
 * on a Monday morning in Montreal who have the switch on and have not had one
 * in six days, and stamps them in the same statement, so a double run cannot
 * send twice. Someone with nothing due and nothing overdue gets no email: an
 * empty digest is noise.
 */
import { sendEmail } from './_email.js'
import { agendaParts, digestPreheader, digestPs, digestSubject } from './_digest-copy.js'

interface Recipient {
  user_id: string
  email: string
  name: string | null
}
interface Row {
  title: string
  date: string | null
  course_id: string | null
  status: string | null
}

const OPEN = new Set(['not-started', 'in-progress', 'extension', null as unknown as string])

export async function runWeeklyDigest(ctx: { supabaseUrl: string; svc: Record<string, string> }): Promise<number> {
  const { supabaseUrl, svc } = ctx
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_weekly_digests`, {
    method: 'POST',
    headers: { ...svc, 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!res.ok) return 0
  const people = (await res.json()) as Recipient[]
  let sent = 0
  const now = Date.now()
  const weekOut = new Date(now + 7 * 86_400_000).toISOString()
  const twoWeeksBack = new Date(now - 14 * 86_400_000).toISOString()

  for (const p of people) {
    const q = new URLSearchParams({
      select: 'title,date,course_id,status',
      user_id: `eq.${p.user_id}`,
      deleted: 'eq.false',
      and: `(date.gte.${twoWeeksBack},date.lte.${weekOut})`,
      order: 'date.asc',
    })
    const [aRes, cRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/assignments?${q}`, { headers: svc }),
      fetch(`${supabaseUrl}/rest/v1/courses?select=id,code&user_id=eq.${p.user_id}&archived=eq.false`, { headers: svc }),
    ])
    if (!aRes.ok || !cRes.ok) continue
    const rows = ((await aRes.json()) as Row[]).filter((r) => OPEN.has(r.status ?? (null as unknown as string)))
    const codes = new Map(((await cRes.json()) as { id: string; code: string }[]).map((c) => [c.id, c.code]))
    const nowIso = new Date(now).toISOString()
    const overdue = rows.filter((r) => r.date && r.date < nowIso)
    const upcoming = rows.filter((r) => r.date && r.date >= nowIso)
    if (upcoming.length === 0 && overdue.length === 0) continue

    const first = p.name?.trim().split(/\s+/)[0]
    const items = upcoming.map((r) => ({
      course: (r.course_id && codes.get(r.course_id)) || null,
      title: r.title,
      due: r.date as string,
    }))
    const paragraphs = [
      items.length
        ? `${first ? `Morning ${first}. ` : ''}You have ${items.length} thing${items.length === 1 ? '' : 's'} due in the next 7 days. Here is the whole week, soonest first.`
        : `${first ? `Morning ${first}. ` : ''}Nothing new is due in the next 7 days.`,
    ]
    if (overdue.length) {
      paragraphs.push(
        `${overdue.length} ${overdue.length === 1 ? 'item is' : 'items are'} past due and still open. If you already handed ${overdue.length === 1 ? 'it' : 'them'} in, tick ${overdue.length === 1 ? 'it' : 'them'} off on Today.`,
      )
    }
    const weekOf = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montreal', month: 'short', day: 'numeric' }).format(new Date(now))
    const ok = await sendEmail({
      to: p.email,
      userId: p.user_id,
      template: 'weekly_digest',
      unsubscribe: 'digest',
      eyebrow: `Week of ${weekOf}`,
      subject: digestSubject(items, overdue.length, now),
      preheader: digestPreheader(items, overdue.length),
      heading: items.length ? 'Your week ahead' : 'A quiet week',
      paragraphs,
      agendaLabel: 'This week',
      agenda: items.slice(0, 12).map((i) => ({ ...agendaParts(i.due, now), course: i.course ?? 'Task', title: i.title })),
      button: { label: 'Open Today', href: 'https://concordiatracker.com/app' },
      signoff: 'Good luck this week,',
      ps: digestPs(now),
      footnote: 'You get this every Monday morning.',
    })
    if (ok) sent++
  }
  return sent
}
