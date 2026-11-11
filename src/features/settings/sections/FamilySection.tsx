import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Mail, UserPlus, X } from 'lucide-react'
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

  const field = 'w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[16px] text-fg outline-none focus:border-accent sm:text-[13px]'

  return (
    <div>
      <Group label="Family access">
        <p className="px-1 pb-3 text-[12.5px] leading-relaxed text-subtle">
          Let a parent or guardian see your courses and deadlines. They can never change anything and never see
          messages or anything social. You choose whether grades are included, and you can end it any time.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Who is it? (e.g. Mom)" aria-label="Who is it" className={field} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Their email (optional)" aria-label="Their email" inputMode="email" className={field} />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void invite()}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast disabled:opacity-50"
        >
          <UserPlus size={14} aria-hidden /> {busy ? 'Creating' : 'Create an invite'}
        </button>
        {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}

        {fresh && (
          <div className="mt-3 rounded-lg border border-accent/40 bg-accent-soft/40 p-3">
            <p className="text-[12.5px] text-fg">
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
          {links.map((l) => (
            <div key={l.id} className="border-b border-border py-3 last:border-0">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-fg">
                  {l.label || l.invite_email || 'Family member'}
                  <span className="ml-2 text-[11.5px] font-normal text-subtle">
                    {l.status === 'active' ? 'Has access' : new Date(l.expires_at) < new Date() ? 'Invite expired' : 'Invite not used yet'}
                  </span>
                </p>
                {l.status === 'pending' && l.invite_email && (
                  <button
                    type="button"
                    title="Email the invite again"
                    onClick={() => void emailGuardianInvite(l.id)}
                    className="grid size-8 place-items-center rounded-lg text-subtle hover:bg-surface-2 hover:text-fg"
                  >
                    <Mail size={14} aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  title={l.status === 'active' ? 'End their access' : 'Cancel the invite'}
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
          ))}
        </Group>
      )}
    </div>
  )
}
