import { useState } from 'react'
import { ExternalLink, Mail, Send } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import type { OrgAccount, OrgInvite } from '@/data/teacher'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Button } from '@/components/ui/Button'
import { Panel, Pill, CopyChip, ConfirmButton, EmptyState } from '../admin-ui'

/** Admin portal for organizer invites — the whole loop in one place (all in-memory
 * demo world): prefill + create a custom invite link, see sent links + their
 * status, and review applications (orgs that confirmed the link) — message to
 * verify, then approve so they go live in Community. */
export function OrgInvitesPanel() {
  const { createOrgInvite, orgInvites, orgs, approveOrg } = useTeacher()
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [email, setEmail] = useState('')
  const [color, setColor] = useState('#5b9cf6')
  const [created, setCreated] = useState<OrgInvite | null>(null)

  const canCreate = name.trim().length > 0 && email.trim().length > 0
  const suggested = suggestHandle(name)

  function create() {
    if (!canCreate) return
    const inv = createOrgInvite({
      orgName: name.trim(),
      orgHandle: handle.trim() || suggested || '@org',
      glyph: deriveGlyph(name),
      color,
      recipientEmail: email.trim(),
    })
    setCreated(inv)
    setName('')
    setHandle('')
    setEmail('')
  }

  const pendingApps = orgs.filter((o) => o.status === 'pending')

  return (
    <div className="space-y-4">
      <Panel title="Create an organizer invite" sub="Prefill a club's details, then send them the link.">
        <div className="space-y-3 p-4">
          <Field label="Organization name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Concordia Robotics Society"
              className={INPUT}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Handle">
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder={suggested || '@conu.robotics'}
                className={INPUT}
              />
            </Field>
            <Field label="Recipient email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="robotics@concordia.ca"
                className={INPUT}
              />
            </Field>
          </div>
          <Field label="Brand colour">
            <div className="flex items-center gap-2.5">
              <ColorPicker value={color} onChange={setColor} ariaLabel="Invite brand colour" />
              <span
                className="grid size-8 place-items-center rounded-lg text-[12px] font-bold text-white"
                style={{ backgroundColor: color }}
                aria-hidden
              >
                {deriveGlyph(name || 'Org')}
              </span>
              <span className="text-[12px] text-subtle">Preview logo</span>
            </div>
          </Field>
          <div className="flex justify-end">
            <Button onClick={create} disabled={!canCreate}>
              <Send size={15} aria-hidden />
              Create invite link
            </Button>
          </div>
          {created && (
            <div className="rounded-lg border border-accent/40 bg-accent-soft/40 p-3">
              <p className="mb-2 text-[12px] font-medium text-fg">
                Invite for <strong>{created.orgName}</strong> is ready — send them this link:
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <CopyChip value={inviteUrl(created)} title="Copy invite link" />
                <a href={mailtoInvite(created)} className={LINK_BTN}>
                  <Mail size={13} aria-hidden />
                  Email it
                </a>
                <a href={`/organizer/invite/${created.token}`} className={LINK_BTN}>
                  <ExternalLink size={13} aria-hidden />
                  Open
                </a>
              </div>
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Sent invites" sub={`${orgInvites.length} link${orgInvites.length === 1 ? '' : 's'}`}>
        {orgInvites.length === 0 ? (
          <EmptyState>No invites yet — create one above.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {orgInvites.map((inv) => (
              <InviteRow key={inv.token} invite={inv} />
            ))}
          </ul>
        )}
      </Panel>

      {pendingApps.length > 0 && (
        <Panel
          title="Applications to review"
          sub="They confirmed the invite — message to verify it's them, then approve."
        >
          <ul className="divide-y divide-border">
            {pendingApps.map((o) => (
              <AppRow key={o.id} org={o} onApprove={() => approveOrg(o.id)} />
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}

const INPUT =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'
const LINK_BTN =
  'inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}

function InviteRow({ invite }: { invite: OrgInvite }) {
  const st = inviteState(invite)
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium text-fg">{invite.orgName}</span>
          <Pill tone={st.tone}>{st.label}</Pill>
        </div>
        <span className="truncate text-[12px] text-subtle">
          {invite.orgHandle} · {invite.recipientEmail}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <CopyChip value={inviteUrl(invite)} title="Copy invite link" />
        {!invite.used && (
          <a href={mailtoInvite(invite)} className={LINK_BTN}>
            <Mail size={13} aria-hidden />
            Message
          </a>
        )}
      </div>
    </li>
  )
}

function AppRow({ org, onApprove }: { org: OrgAccount; onApprove: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-fg">{org.org.name}</span>
        <span className="truncate text-[12px] text-subtle">
          {org.org.handle} · {org.email}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <a href={mailtoVerify(org)} className={LINK_BTN}>
          <Mail size={13} aria-hidden />
          Message to verify
        </a>
        <ConfirmButton label="Approve" armedLabel="Confirm approve" onConfirm={onApprove} />
      </div>
    </li>
  )
}

// ── helpers ──────────────────────────────────────────────────────────────────
function deriveGlyph(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'OR'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function suggestHandle(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
  return slug ? `@${slug}` : ''
}

function inviteUrl(inv: OrgInvite): string {
  return `${window.location.origin}/organizer/invite/${inv.token}`
}

function inviteState(inv: OrgInvite): { label: string; tone: string } {
  if (inv.used) return { label: 'Confirmed', tone: 'green' }
  const left = inv.expiresInDays - inv.createdDaysAgo
  if (left <= 0) return { label: 'Expired', tone: 'red' }
  return { label: `Expires in ${left}d`, tone: 'amber' }
}

function mailtoInvite(inv: OrgInvite): string {
  const subject = encodeURIComponent(`Your ConcordiaTracker organizer invite — ${inv.orgName}`)
  const body = encodeURIComponent(
    `Hi,\n\nYou're invited to manage ${inv.orgName} (${inv.orgHandle}) on ConcordiaTracker. ` +
      `Open this link to confirm and set up your dashboard:\n\n${inviteUrl(inv)}\n\n` +
      `The link is single-use and expires soon.\n\n— ConcordiaTracker`,
  )
  return `mailto:${inv.recipientEmail}?subject=${subject}&body=${body}`
}

function mailtoVerify(o: OrgAccount): string {
  const subject = encodeURIComponent(`Verifying your ${o.org.name} organizer account`)
  const body = encodeURIComponent(
    `Hi,\n\nWe're reviewing the organizer application for ${o.org.name} (${o.org.handle}). ` +
      `Can you confirm a couple of details so we can verify it's really you before approving?\n\n— ConcordiaTracker`,
  )
  return `mailto:${o.email}?subject=${subject}&body=${body}`
}
