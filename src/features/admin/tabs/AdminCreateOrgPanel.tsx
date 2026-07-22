import { useState } from 'react'
import { Building2, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Button } from '@/components/ui/Button'
import { Panel, CopyChip } from '../admin-ui'

const INPUT =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

/** Admin: create a fully set-up, ownerless organization, then mint a single-use
 * HANDOFF link so a club claims it (inheriting the profile you built). Uses
 * admin_create_org + the org-targeted org_invites row. */
export function AdminCreateOrgPanel() {
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [color, setColor] = useState('#5b9cf6')
  const [bio, setBio] = useState('')
  const [logo, setLogo] = useState('')
  const [banner, setBanner] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [link, setLink] = useState<{ url: string; token: string } | null>(null)

  const suggested = suggestHandle(name)
  const canCreate = name.trim().length >= 2 && !busy

  async function createAndHandoff() {
    if (!canCreate) return
    setBusy(true)
    setErr('')
    setLink(null)
    const h = (handle.trim() || suggested || '@org').replace(/^@?/, '@')
    const glyph = deriveGlyph(name)
    const { data: orgId, error: e1 } = await supabase.rpc('admin_create_org', {
      p_name: name.trim(),
      p_handle: h,
      p_glyph: glyph,
      p_color: color,
      p_bio: bio.trim(),
      p_logo: logo.trim() || null,
      p_banner: banner.trim() || null,
    })
    if (e1 || !orgId) {
      setBusy(false)
      setErr(e1?.message ?? 'Could not create the organization.')
      return
    }
    const token = `${slugOf(name)}-${crypto.randomUUID().replace(/-/g, '').slice(0, 6)}`
    const { error: e2 } = await supabase.from('org_invites').insert({
      token,
      org_name: name.trim(),
      org_handle: h,
      glyph,
      color,
      recipient_email: email.trim() || null,
      max_uses: 1,
      org_id: orgId,
    })
    setBusy(false)
    if (e2) {
      setErr(`Org created, but the invite failed: ${e2.message}`)
      return
    }
    setLink({ url: `${window.location.origin}/join/${token}`, token })
    setName('')
    setHandle('')
    setBio('')
    setLogo('')
    setBanner('')
    setEmail('')
  }

  return (
    <Panel
      title="Create & hand off an organization"
      sub="Build the profile yourself, then send a single-use link for the club to claim it."
    >
      <div className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Organization name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Molson Marketing Association" className={INPUT} />
          </Field>
          <Field label="Handle">
            <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder={suggested || '@jmma'} className={INPUT} />
          </Field>
        </div>
        <Field label="Bio">
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} placeholder="A short description students see." className={INPUT + ' resize-none'} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Logo URL">
            <input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…" className={INPUT} />
          </Field>
          <Field label="Banner URL">
            <input value={banner} onChange={(e) => setBanner(e.target.value)} placeholder="https://…" className={INPUT} />
          </Field>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Brand colour">
            <div className="flex items-center gap-2.5">
              <ColorPicker value={color} onChange={setColor} ariaLabel="Brand colour" />
              <span className="grid size-8 place-items-center rounded-lg text-[12px] font-bold text-white" style={{ backgroundColor: color }} aria-hidden>
                {deriveGlyph(name || 'Org')}
              </span>
            </div>
          </Field>
          <Field label="Recipient email (optional)">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vp@club.ca" className={INPUT} />
          </Field>
          <div className="ml-auto">
            <Button onClick={createAndHandoff} disabled={!canCreate}>
              <Building2 size={15} aria-hidden />
              {busy ? 'Creating…' : 'Create & get handoff link'}
            </Button>
          </div>
        </div>
        {err && <p className="text-[12px] text-danger">{err}</p>}
        {link && (
          <div className="rounded-lg border border-accent/40 bg-accent-soft/40 p-3">
            <p className="mb-2 text-[12px] font-medium text-fg">
              Organization created + set up. Send this single-use handoff link:
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <CopyChip value={link.url} title="Copy handoff link" />
              <a
                href={`/join/${link.token}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
              >
                <ExternalLink size={13} aria-hidden />
                Open
              </a>
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}

function slugOf(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'org'
}
function suggestHandle(name: string): string {
  const s = slugOf(name)
  return s === 'org' ? '' : `@${s}`
}
function deriveGlyph(name: string): string {
  const w = name.trim().split(/\s+/).filter(Boolean)
  if (w.length === 0) return 'OR'
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase()
  return (w[0][0] + w[1][0]).toUpperCase()
}
