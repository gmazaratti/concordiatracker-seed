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
import { cleanLinks, type ProfileLinks } from '@/lib/social'
import { useT } from '@/i18n/i18n'

/** Public-profile controls — the opt-in toggle, the bio, and a link to view it.
 * Reads profile_public/bio defensively (degrades if not migrated yet). */
function PublicProfileSettings() {
  const t = useT()
  const { user, updatePrivacy } = useAppData()
  const { user: authUser } = useAuth()
  const [pub, setPub] = useState(false)
  const [bio, setBio] = useState('')
  // Each of these is its own disclosure, and each starts closed. "My profile
  // exists" and "here is exactly what I am taking and when" are not the same
  // consent, and neither should ride on the other.
  const [coursesPub, setCoursesPub] = useState(false)
  const [scheduleFriends, setScheduleFriends] = useState(false)
  const [links, setLinks] = useState<ProfileLinks>({})

  useEffect(() => {
    if (!authUser) return
    let active = true
    void supabase
      .from('user_profile')
      .select('profile_public, bio, courses_public, schedule_visibility, links')
      .eq('user_id', authUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        const r = data as {
          profile_public?: boolean
          bio?: string
          courses_public?: boolean
          schedule_visibility?: string
          links?: unknown
        } | null
        setPub(!!r?.profile_public)
        setBio(r?.bio ?? '')
        setCoursesPub(!!r?.courses_public)
        setScheduleFriends(r?.schedule_visibility === 'friends')
        setLinks(cleanLinks(r?.links))
      })
    return () => {
      active = false
    }
  }, [authUser])

  /** Written directly rather than through `updatePrivacy`, which predates
   *  these columns. Failures are swallowed: an unrun migration should cost a
   *  toggle, not the settings panel. */
  const write = (patch: Record<string, unknown>) => {
    if (!authUser) return
    void supabase.from('user_profile').update(patch).eq('user_id', authUser.id)
  }

  return (
    <Group label={t('settings.profilePublic')}>
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
      <Row
        label="Show my classes"
        description="Lists the courses you are taking on your public profile — code, title and term only. Never a grade."
      >
        <Switch
          checked={coursesPub}
          onChange={(v) => {
            setCoursesPub(v)
            write({ courses_public: v })
          }}
          label="Show my classes"
        />
      </Row>

      <Row
        label="Let friends see my schedule"
        description="Friends can see when and where your classes meet, so nobody has to send a screenshot. Times and rooms only, and only people you accepted."
      >
        <Switch
          checked={scheduleFriends}
          onChange={(v) => {
            setScheduleFriends(v)
            write({ schedule_visibility: v ? 'friends' : 'private' })
          }}
          label="Let friends see my schedule"
        />
      </Row>

      <Row label="Links" description="Shown on your public profile. A handle or a full URL both work." stacked>
        <div className="grid gap-2 sm:grid-cols-2">
          {LINK_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-[11.5px] text-subtle">{f.label}</span>
              <input
                value={links[f.key] ?? ''}
                onChange={(e) => setLinks((prev) => ({ ...prev, [f.key]: e.target.value }))}
                onBlur={() => write({ links: cleanLinks(links) })}
                placeholder={f.placeholder}
                maxLength={200}
                className="w-full rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-[12.5px] text-fg outline-none transition-colors placeholder:text-subtle focus:border-border-strong"
              />
            </label>
          ))}
        </div>
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

const LINK_FIELDS: { key: keyof ProfileLinks; label: string; placeholder: string }[] = [
  { key: 'instagram', label: 'Instagram', placeholder: '@yourhandle' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'your-name' },
  { key: 'x', label: 'X', placeholder: '@yourhandle' },
  { key: 'website', label: 'Website', placeholder: 'yoursite.com' },
]

const DOCS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/terms', label: 'Terms of Service', icon: FileText },
  { to: '/privacy', label: 'Privacy Policy', icon: ShieldCheck },
  { to: '/educator', label: 'Educator Agreement', icon: Scale },
]

/** Privacy: a Law 25 note, links out to the (draft) legal documents, and the
 * data-rights contact path. */
export function PrivacySection() {
  const t = useT()
  const { closeSettings } = useSettings()

  return (
    <div>
      <PublicProfileSettings />

      <p className="mb-5 text-[13px] leading-relaxed text-muted">
        ConcordiaTracker complies with Quebec&rsquo;s Law 25. The full documents
        below are <span className="font-medium text-warning">drafts pending review</span>{' '}
       : not finalized legal text.
      </p>

      <Group label={t('settings.legalDocs')}>
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

      <Group label={t('settings.yourData')}>
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
