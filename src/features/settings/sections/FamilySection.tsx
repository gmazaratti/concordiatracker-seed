import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Eye, EyeOff, Link2, Mail, UserPlus, X } from 'lucide-react'
import {
  emailGuardianInvite,
  endGuardianLink,
  guardianInviteUrl,
  inviteGuardian,
  myGuardianLinks,
  setGuardianAccess,
  type GuardianLink,
} from '@/lib/guardians'
import { Group, Row, Switch } from '../controls'

const STEPS = [
  { n: 1, title: 'You send a link', body: 'Create an invite below. Add their email and we send it, or copy the link yourself.' },
  { n: 2, title: 'They make a free account', body: 'They open the link and sign in. It works once and expires in 14 days.' },
  { n: 3, title: 'They can look, not touch', body: 'They see your courses and what is due. You can end it any time.' },
]

/**
 * Family access: let a parent or guardian SEE your courses and deadlines.
 *
 * Everything here is the student's call. They invite, they choose whether
 * grades and saved schedules are included, and they can end it at any time.
 * A parent can never edit anything, and never sees anything social.
 */
export function FamilySection() {
  const [links, setLinks] = useState<GuardianLink[] | null>(null)
  const [email, setEmail] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fresh, setFresh] = useState<{ id: string; url: string; emailed: boolean | null } | null>(null)
  const [copied, setCopied] = useState(false)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    let alive = true
    void myGuardianLinks()
      .then((l) => alive && setLinks(l))
      .catch(() => alive && setLinks([]))
    return () => {
      alive = false
    }
  }, [tick])

  async function invite() {
    setBusy(true)
    setError('')
    try {
      const token = await inviteGuardian(email, label)
      const list = await myGuardianLinks()
      setLinks(list)
      const link = list.find((l) => l.token === token)
      const emailed = email.trim() && link ? await emailGuardianInvite(link.id) : null
      setFresh({ id: link?.id ?? '', url: guardianInviteUrl(token), emailed })
      setEmail('')
      setLabel('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.')
    }
    setBusy(false)
  }

  async function update(l: GuardianLink, patch: Partial<Pick<GuardianLink, 'can_see_grades' | 'can_see_schedule'>>) {
    const next = { ...l, ...patch }
    setLinks((list) => (list ?? []).map((x) => (x.id === l.id ? next : x)))
    try {
      await setGuardianAccess(l.id, next.can_see_grades, next.can_see_schedule)
    } catch {
      reload()
    }
  }

  const field =
    'w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[16px] text-fg outline-none focus:border-accent sm:text-[13px]'

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-[16px] font-semibold text-fg">Let a parent follow along</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-subtle">
          A parent or guardian can see what you have due, without texting you to ask. They can never change anything.
        </p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-xl border border-border bg-surface p-3">
              <span className="grid size-6 place-items-center rounded-full bg-accent-soft text-[12px] font-bold text-accent">{s.n}</span>
              <p className="mt-2 text-[13px] font-semibold text-fg">{s.title}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-subtle">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-fg">
              <Eye size={13} className="text-success" aria-hidden /> What they see
            </p>
            <ul className="mt-1.5 space-y-0.5 text-[12px] text-muted">
              <li>Your courses and class times</li>
              <li>What is due and when</li>
              <li>Grades and saved schedules, only if you turn them on</li>
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-fg">
              <EyeOff size={13} className="text-subtle" aria-hidden /> What they never see
            </p>
            <ul className="mt-1.5 space-y-0.5 text-[12px] text-muted">
              <li>Your messages and anything social</li>
              <li>Your notes</li>
              <li>Anything they could edit</li>
            </ul>
          </div>
        </div>
      </div>

      <Group label="Invite someone" padded>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Who is it?</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Mom" className={`${field} mt-1`} />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted">Their email (optional)</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="We send them the link"
              inputMode="email"
              className={`${field} mt-1`}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void invite()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast disabled:opacity-50"
        >
          <UserPlus size={14} aria-hidden /> {busy ? 'Creating' : email.trim() ? 'Send the invite' : 'Create an invite link'}
        </button>
        {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}

        {fresh && (
          <div className="mt-3 rounded-lg border border-accent/40 bg-accent-soft/40 p-3">
            <p className="flex items-center gap-1.5 text-[12.5px] text-fg">
              <Link2 size={13} className="text-accent" aria-hidden />
              {fresh.emailed
                ? 'Sent by email. You can also share the link yourself:'
                : fresh.emailed === false
                  ? 'The email did not go out, so share this link yourself:'
                  : 'Send them this link. It works once and expires in 14 days:'}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-canvas px-2 py-1.5 text-[12px] text-fg select-all">{fresh.url}</code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(fresh.url).then(() => {
                    setCopied(true)
                    window.setTimeout(() => setCopied(false), 1500)
                  })
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] text-muted hover:text-fg"
              >
                {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </Group>

      {links && links.length > 0 && (
        <Group label="People with access">
          {links.map((l) => {
            const expired = l.status === 'pending' && new Date(l.expires_at) < new Date()
            return (
              <div key={l.id} className="border-b border-border last:border-0">
                <div className="flex items-center gap-2 px-4 pt-3.5">
                  <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-fg">
                    {l.label || l.invite_email || 'Family member'}
                  </p>
                  <span
                    className={
                      l.status === 'active'
                        ? 'rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success'
                        : 'rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-subtle'
                    }
                  >
                    {l.status === 'active' ? 'Has access' : expired ? 'Invite expired' : 'Waiting for them'}
                  </span>
                  {l.status === 'pending' && l.invite_email && !expired && (
                    <button
                      type="button"
                      title="Email the invite again"
                      aria-label="Email the invite again"
                      onClick={() => void emailGuardianInvite(l.id)}
                      className="grid size-8 place-items-center rounded-lg text-subtle hover:bg-surface-2 hover:text-fg"
                    >
                      <Mail size={14} aria-hidden />
                    </button>
                  )}
                  <button
                    type="button"
                    title={l.status === 'active' ? 'End their access' : 'Cancel the invite'}
                    aria-label={l.status === 'active' ? 'End their access' : 'Cancel the invite'}
                    onClick={() => void endGuardianLink(l.id).then(reload)}
                    className="grid size-8 place-items-center rounded-lg text-subtle hover:bg-danger/10 hover:text-danger"
                  >
                    <X size={15} aria-hidden />
                  </button>
                </div>
                <Row label="Show my grades" description="Grades on each assessment and finished courses.">
                  <Switch checked={l.can_see_grades} onChange={(v) => void update(l, { can_see_grades: v })} label="Show my grades" />
                </Row>
                <Row label="Show my saved schedules" description="Schedules you saved in the schedule builder.">
                  <Switch checked={l.can_see_schedule} onChange={(v) => void update(l, { can_see_schedule: v })} label="Show my saved schedules" />
                </Row>
              </div>
            )
          })}
        </Group>
      )}
    </div>
  )
}
