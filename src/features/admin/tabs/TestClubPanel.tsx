import { useState } from 'react'
import { FlaskConical, LogIn } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Panel, CopyChip } from '../admin-ui'

interface Made {
  id: string
  name: string
  handle: string
  token: string
}

/**
 * One press, one throwaway club — for testing the organizer flow on a fresh
 * account without asking anybody for an invite.
 *
 * WHAT IT MAKES, and why each part:
 * - a random name and a handle that passes `ct_handle_ok` (letters, digits,
 *   underscore), so the setup wizard's handle step can never refuse it — a
 *   handle the wizard rejects is exactly how setup became impossible to finish;
 * - status PENDING and unverified, so a test club is never in any student's
 *   feed or search: `organizations` is only public-read when approved;
 * - a single-use HANDOFF link. Open it in a private window and sign up, and
 *   you are a brand-new president meeting the portal for the first time. Or
 *   press "Set it up here", which consumes the link on this account and lands
 *   in the wizard.
 *
 * Delete it from the Organizations list when you are done.
 */
export function TestClubPanel() {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [made, setMade] = useState<Made | null>(null)

  async function create() {
    setBusy(true)
    setErr('')
    const tag = crypto.randomUUID().replace(/-/g, '').slice(0, 6)
    const name = `Test Club ${tag.slice(0, 4).toUpperCase()}`
    const handle = `@testclub_${tag}`
    const { data: id, error } = await supabase.rpc('admin_create_org', {
      p_name: name,
      p_handle: handle,
      p_glyph: 'TC',
      p_color: '#7a8a9e',
      p_bio: '',
      p_verified: false,
    })
    if (error || !id) {
      setBusy(false)
      setErr(error?.message ?? 'Could not create the test club.')
      return
    }
    const pending = await supabase.rpc('admin_set_org_status', { p_org_id: id, p_status: 'pending' })
    const token = `testclub-${tag}`
    const invite = await supabase.from('org_invites').insert({
      token,
      org_name: name,
      org_handle: handle,
      glyph: 'TC',
      color: '#7a8a9e',
      max_uses: 1,
      org_id: id,
    })
    setBusy(false)
    if (pending.error) setErr(`Created, but it is still public: ${pending.error.message}`)
    if (invite.error) {
      setErr(`Created ${handle}, but the link failed: ${invite.error.message}`)
      return
    }
    setMade({ id: id as string, name, handle, token })
  }

  async function setUpHere() {
    if (!made) return
    setBusy(true)
    setErr('')
    const { error } = await supabase.rpc('accept_org_invite', { p_token: made.token, p_force: true })
    if (error) {
      setBusy(false)
      setErr(error.message)
      return
    }
    // A full load: the portal provider read its clubs before this one was ours.
    window.location.assign(`/organizer?org=${made.id}`)
  }

  const url = made ? `${window.location.origin}/join/${made.token}` : ''

  return (
    <Panel title="Test club" sub="A private throwaway club for walking the organizer flow yourself.">
      <div className="space-y-3 p-4">
        <p className="text-[12.5px] leading-relaxed text-subtle">
          Creates a pending, unverified club students can't see, with a single-use link. Open the link in a
          private window and sign up to test it as a brand-new president.
        </p>
        <Button onClick={() => void create()} disabled={busy}>
          <FlaskConical size={15} aria-hidden />
          {busy && !made ? 'Creating…' : made ? 'Create another' : 'Create a test club'}
        </Button>
        {err && <p className="text-[12px] text-danger">{err}</p>}
        {made && (
          <div className="rounded-lg border border-accent/40 bg-accent-soft/40 p-3">
            <p className="text-[12.5px] font-medium text-fg">
              {made.name} <span className="font-normal text-subtle">{made.handle}</span>
            </p>
            <p className="mt-1 mb-2 text-[12px] text-subtle">Fresh account: copy this into a private window.</p>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="min-w-0 max-w-full flex-1">
                <CopyChip value={url} title="Copy the claim link" />
              </span>
              <button
                type="button"
                onClick={() => void setUpHere()}
                disabled={busy}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg disabled:opacity-50"
              >
                <LogIn size={13} aria-hidden />
                Set it up here
              </button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}
