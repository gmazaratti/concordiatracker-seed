import { useState } from 'react'
import { ArrowRight, PenLine } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { Button } from '@/components/ui/Button'
import { UsesField, ExpiryField } from './InviteLimits'
import { updateClubInvite, type ClubInvite } from './club-invites'

/**
 * Uses and expiry can change at any time; the server will not let uses drop
 * below what has already been used. A pre-filled club's profile is edited in
 * the club's own editors, not a second copy of them here.
 */
export function EditInviteModal({ invite: i, onClose, onSaved }: { invite: ClubInvite; onClose: () => void; onSaved: () => void }) {
  const [uses, setUses] = useState(i.max_uses)
  const [expires, setExpires] = useState(i.expires_at)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    setBusy(true)
    setErr('')
    try {
      await updateClubInvite(i.token, uses, expires)
      onSaved()
      onClose()
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <ModalShell label={`Edit invite for ${i.org_name}`} onClose={onClose} widthClass="sm:max-w-lg">
      <div className="space-y-5 px-5 pt-6 pb-5">
        <h2 className="text-[18px] font-semibold text-fg">Edit invite · {i.org_name}</h2>
        <UsesField value={uses} used={i.use_count} onChange={setUses} />
        <ExpiryField value={expires} onChange={setExpires} />
        {i.org_id && (
          <button
            type="button"
            onClick={() => window.location.assign(`/organizer?org=${i.org_id}`)}
            className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-surface-2"
          >
            <PenLine size={18} className="shrink-0 text-accent" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-medium text-fg">
                {i.use_count > 0 ? 'Open the club' : 'Edit the pre-filled club'}
              </span>
              <span className="block text-[12px] text-subtle">Profile, logo, banner, links, events and posts.</span>
            </span>
            <ArrowRight size={16} className="text-subtle" aria-hidden />
          </button>
        )}
        {err && <p className="text-[12.5px] text-danger">{err}</p>}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </ModalShell>
  )
}
