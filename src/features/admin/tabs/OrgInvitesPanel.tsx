import { useCallback, useState } from 'react'
import { ExternalLink, Mail, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Button } from '@/components/ui/Button'
import { useAdminList } from '../admin-data'
import { Panel, Pill, CopyChip, ConfirmButton, EmptyState, Loading } from '../admin-ui'

interface InviteRowData {
  id: string
  token: string
  org_name: string
  org_handle: string
  recipient_email: string | null
  max_uses: number
  use_count: number
  expires_at: string
  created_at: string
}

/** Admin portal for REAL organizer invites (the org_invites table): prefill a
 * club's details → mint a single-use (or limited-use), expiring, revocable link.
 * The recipient opens it, signs in with Google, accepts → a PENDING org +
 * onboarding; you approve it in the Organizer portals list below. */
export function OrgInvitesPanel() {
  const loader = useCallback(async () => {
    const { data, error } = await supabase
      .from('org_invites')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data as InviteRowData[]) ?? []
  }, [])
  const invites = useAdminList<InviteRowData>(loader)

  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [email, setEmail] = useState('')
  const [color, setColor] = useState('#5b9cf6')
  const [maxUses, setMaxUses] = useState('1')
  const [created, setCreated] = useState<InviteRowData | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const suggested = suggestHandle(name)
  const canCreate = name.trim().length > 0 && !busy

  async function create() {
    if (!canCreate) return
    setBusy(true)
    setErr('')
    const row = {
      token: mintToken(),
      org_name: name.trim(),
      org_handle: (handle.trim() || suggested || '@org').replace(/^@?/, '@'),
      glyph: deriveGlyph(name),
      color,
      recipient_email: email.trim() || null,
      max_uses: Math.max(1, parseInt(maxUses, 10) || 1),
    }
    const { data, error } = await supabase.from('org_invites').insert(row).select('*').maybeSingle()
    setBusy(false)
    if (error || !data) {
      setErr(error?.message ?? 'Could not create the invite.')
      return
    }
    setCreated(data as InviteRowData)
    setName('')
    setHandle('')
    setEmail('')
    setMaxUses('1')
    invites.reload()
  }

  async function revoke(id: string) {
    await supabase.from('org_invites').delete().eq('id', id)
    if (created?.id === id) setCreated(null)
    invites.reload()
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Create an organizer invite"
        sub="Single-use by default; the link dies once accepted. You approve the org after."
      >
        <div className="space-y-3 p-4">
          <Field label="Organization name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Arts & Science Federation of Associations" className={INPUT} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Handle">
              <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder={suggested || '@asfa'} className={INPUT} />
            </Field>
            <Field label="Recipient email (optional)">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vp@club.ca" className={INPUT} />
            </Field>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Brand colour">
              <div className="flex items-center gap-2.5">
                <ColorPicker value={color} onChange={setColor} ariaLabel="Invite brand colour" />
                <span className="grid size-8 place-items-center rounded-lg text-[12px] font-bold text-white" style={{ backgroundColor: color }} aria-hidden>
                  {deriveGlyph(name || 'Org')}
                </span>
              </div>
            </Field>
            <Field label="Uses">
              <input
                type="number"
                min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                className={INPUT + ' w-20'}
                aria-label="Maximum uses"
              />
            </Field>
            <div className="ml-auto">
              <Button onClick={create} disabled={!canCreate}>
                <Send size={15} aria-hidden />
                {busy ? 'Creating…' : 'Create invite link'}
              </Button>
            </div>
          </div>
          {err && <p className="text-[12px] text-danger">{err}</p>}
          {created && (
            <div className="rounded-lg border border-accent/40 bg-accent-soft/40 p-3">
              <p className="mb-2 text-[12px] font-medium text-fg">
                Invite for <strong>{created.org_name}</strong> is live — send them this link:
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <CopyChip value={inviteUrl(created.token)} title="Copy invite link" />
                {created.recipient_email && (
                  <a href={mailtoInvite(created)} className={LINK_BTN}>
                    <Mail size={13} aria-hidden />
                    Email it
                  </a>
                )}
                <a href={`/organizer/invite/${created.token}`} className={LINK_BTN}>
                  <ExternalLink size={13} aria-hidden />
                  Open
                </a>
              </div>
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Sent invites" sub={invites.loading ? 'Loading…' : `${invites.items.length} link${invites.items.length === 1 ? '' : 's'}`}>
        {invites.loading ? (
          <Loading />
        ) : invites.items.length === 0 ? (
          <EmptyState>No invites yet — create one above.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {invites.items.map((inv) => (
              <InviteRow key={inv.id} invite={inv} onRevoke={() => revoke(inv.id)} />
            ))}
          </ul>
        )}
      </Panel>
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

function InviteRow({ invite, onRevoke }: { invite: InviteRowData; onRevoke: () => void }) {
  const st = inviteState(invite)
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium text-fg">{invite.org_name}</span>
          <Pill tone={st.tone}>{st.label}</Pill>
          {invite.max_uses > 1 && (
            <span className="text-[11px] text-subtle tabular-nums">
              {invite.use_count}/{invite.max_uses} used
            </span>
          )}
        </div>
        <span className="truncate text-[12px] text-subtle">
          {invite.org_handle}
          {invite.recipient_email ? ` · ${invite.recipient_email}` : ''}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <CopyChip value={inviteUrl(invite.token)} title="Copy invite link" />
        {invite.recipient_email && st.tone !== 'green' && (
          <a href={mailtoInvite(invite)} className={LINK_BTN}>
            <Mail size={13} aria-hidden />
            Message
          </a>
        )}
        <ConfirmButton label="Revoke" armedLabel="Confirm revoke" danger onConfirm={onRevoke} />
      </div>
    </li>
  )
}

// ── helpers ──────────────────────────────────────────────────────────────────
function mintToken(): string {
  return 'oiv_' + crypto.randomUUID().replace(/-/g, '').slice(0, 20)
}

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

function inviteUrl(token: string): string {
  return `${window.location.origin}/organizer/invite/${token}`
}

function inviteState(inv: InviteRowData): { label: string; tone: string } {
  if (inv.use_count >= inv.max_uses) return { label: 'Accepted', tone: 'green' }
  const msLeft = new Date(inv.expires_at).getTime() - Date.now()
  if (msLeft <= 0) return { label: 'Expired', tone: 'red' }
  const days = Math.ceil(msLeft / 86_400_000)
  return { label: `Expires in ${days}d`, tone: 'amber' }
}

function mailtoInvite(inv: InviteRowData): string {
  const subject = encodeURIComponent(`Your ConcordiaTracker organizer invite — ${inv.org_name}`)
  const body = encodeURIComponent(
    `Hi,\n\nHere's your organizer sign-up link for ${inv.org_name} on ConcordiaTracker:\n\n${inviteUrl(inv.token)}\n\n` +
      `Open it, sign in with Google, and the onboarding will walk you through setting up your profile and posting your first event. ` +
      `The link is single-use and expires in 14 days.\n\n— Alex, ConcordiaTracker`,
  )
  return `mailto:${inv.recipient_email}?subject=${subject}&body=${body}`
}
