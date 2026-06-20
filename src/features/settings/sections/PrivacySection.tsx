import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronRight,
  ExternalLink,
  FileText,
  Mail,
  Scale,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { useSettings } from '@/app/providers/settings'
import { useAppData } from '@/app/providers/app-data'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'
import { Group, Row, Switch, Flag } from '../controls'

/** Public-profile controls — the opt-in toggle, the bio, and a link to view it.
 * Reads profile_public/bio defensively (degrades if not migrated yet). */
function PublicProfileSettings() {
  const { user, updatePrivacy } = useAppData()
  const { user: authUser } = useAuth()
  const [pub, setPub] = useState(false)
  const [bio, setBio] = useState('')

  useEffect(() => {
    if (!authUser) return
    let active = true
    void supabase
      .from('user_profile')
      .select('profile_public, bio')
      .eq('user_id', authUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        const r = data as { profile_public?: boolean; bio?: string } | null
        setPub(!!r?.profile_public)
        setBio(r?.bio ?? '')
      })
    return () => {
      active = false
    }
  }, [authUser])

  return (
    <Group label="Public profile">
      <Row
        label="Public profile"
        description={
          user.handle
            ? `Show your profile at concordiatracker.com/@${user.handle}.`
            : 'Show a public profile page at your handle.'
        }
      >
        <Switch
          checked={pub}
          onChange={(v) => {
            setPub(v)
            updatePrivacy({ profilePublic: v })
          }}
          label="Public profile"
        />
      </Row>
      <Row label="Bio" description="A short description shown on your public profile." stacked>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          onBlur={() => updatePrivacy({ bio })}
          maxLength={280}
          rows={3}
          placeholder="A line or two about you…"
          className="w-full resize-none rounded-lg border border-border bg-canvas px-3 py-2 text-[13px] text-fg outline-none transition-colors placeholder:text-subtle focus:border-border-strong"
        />
      </Row>
      {user.handle && (
        <a
          href={`/@${user.handle}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2/50"
        >
          <ExternalLink size={16} className="shrink-0 text-subtle" aria-hidden />
          <span className="text-[13px] font-medium text-fg">View my public profile</span>
          <span className="ml-auto text-[12px] text-subtle">{pub ? `@${user.handle}` : 'private'}</span>
        </a>
      )}
    </Group>
  )
}

const DOCS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/terms', label: 'Terms of Service', icon: FileText },
  { to: '/privacy', label: 'Privacy Policy', icon: ShieldCheck },
  { to: '/educator', label: 'Educator Agreement', icon: Scale },
]

/** Privacy: a Law 25 note, links out to the (draft) legal documents, and the
 * data-rights contact path. */
export function PrivacySection() {
  const { closeSettings } = useSettings()

  return (
    <div>
      <PublicProfileSettings />

      <p className="mb-5 text-[13px] leading-relaxed text-muted">
        ConcordiaTracker complies with Quebec&rsquo;s Law 25. The full documents
        below are <span className="font-medium text-warning">drafts pending review</span>{' '}
        — not finalized legal text.
      </p>

      <Group label="Legal documents">
        {DOCS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={() => closeSettings()}
            className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2/50"
          >
            <Icon size={16} className="shrink-0 text-subtle" aria-hidden />
            <span className="text-[13px] font-medium text-fg">{label}</span>
            <Flag />
            <ChevronRight size={16} className="ml-auto shrink-0 text-subtle" aria-hidden />
          </Link>
        ))}
      </Group>

      <Group label="Your data (Law 25)">
        <Row
          label="Access, correct, or delete your data"
          description="Withdraw consent or request a copy at any time."
        />
        <a
          href="mailto:concordiatracker@gmail.com"
          className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2/50"
        >
          <Mail size={16} className="shrink-0 text-subtle" aria-hidden />
          <span className="text-[13px] font-medium text-fg">Privacy &amp; data contact</span>
          <span className="ml-auto text-[12px] text-subtle">concordiatracker@gmail.com</span>
        </a>
      </Group>
    </div>
  )
}
