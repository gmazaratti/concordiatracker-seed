import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Loader2 } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { useAppData } from '@/app/providers/app-data'
import { useAuth } from '@/app/providers/auth'
import { Switch } from '@/features/settings/controls'
import { supabase } from '@/lib/supabase'
import { cleanLinks, type ProfileLinks } from '@/lib/social'
import { BioField } from '@/components/ui/BioField'

/**
 * Edit your profile, on your profile.
 *
 * The button used to be a `Link` to `/app?settings=account`, which did not
 * work AT ALL from inside the app: `SettingsProvider` reads that param once on
 * mount and sits above the router, so a client-side navigation dropped you on
 * Today instead. The same trap the Today prompts fell into.
 *
 * Opening the settings panel would have fixed the bug, but it is still the
 * wrong answer: Settings is a different context that covers the thing you are
 * editing. You want to change your bio while LOOKING at your bio, so the
 * editor is a dialog on the page and the page updates underneath when you
 * save. What is here is exactly the profile: the fields a visitor sees, plus
 * the three switches that decide how much of it they see. Nothing about
 * billing, themes or notifications — those stay in Settings, where they
 * belong.
 */
const LINK_FIELDS: { key: keyof ProfileLinks; label: string; placeholder: string }[] = [
  { key: 'instagram', label: 'Instagram', placeholder: '@you, you, or a link' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'your-name' },
  { key: 'x', label: 'X', placeholder: '@you, you, or a link' },
  { key: 'website', label: 'Website', placeholder: 'yoursite.com' },
]

export function EditProfileModal({
  onClose,
  onSaved,
}: {
  onClose: () => void
  /** Re-read the profile so the page behind shows the change immediately. */
  onSaved: () => void
}) {
  const { user, updateProfile, updatePrivacy } = useAppData()
  const { user: authUser } = useAuth()

  const [name, setName] = useState(user.name ?? '')
  const [bio, setBio] = useState('')
  const [links, setLinks] = useState<ProfileLinks>({})
  const [pub, setPub] = useState(false)
  const [scheduleFriends, setScheduleFriends] = useState(false)
  // Defaults TRUE where the column does, so an unrun migration cannot make a
  // profile look like its owner turned their major off.
  const [programPub, setProgramPub] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasBlueprints, setHasBlueprints] = useState(true)

  useEffect(() => {
    if (!authUser) return
    let alive = true
    void supabase
      .from('user_profile')
      .select('profile_public, bio, courses_public, schedule_visibility, links, program_public')
      .eq('user_id', authUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        const r = data as {
          profile_public?: boolean
          bio?: string
          courses_public?: boolean
          schedule_visibility?: string
          links?: unknown
          program_public?: boolean
        } | null
        setPub(!!r?.profile_public)
        setBio(r?.bio ?? '')
        setScheduleFriends(r?.schedule_visibility === 'friends')
        setProgramPub(r?.program_public !== false)
        setLinks(cleanLinks(r?.links))
        setLoaded(true)
      })
    void supabase
      .from('shared_blueprints')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', authUser.id)
      .then(({ count }) => {
        if (alive) setHasBlueprints((count ?? 0) > 0)
      })
    return () => {
      alive = false
    }
  }, [authUser])

  async function save() {
    if (!authUser || saving) return
    setSaving(true)
    const trimmed = name.trim()
    if (trimmed && trimmed !== user.name) updateProfile({ name: trimmed })
    updatePrivacy({ bio: bio.trim(), profilePublic: pub })
    // The three columns `updatePrivacy` predates. Failures are swallowed for
    // the same reason the settings panel swallows them: an unrun migration
    // should cost a field, not the dialog.
    await supabase
      .from('user_profile')
      .update({
        program_public: programPub,
        schedule_visibility: scheduleFriends ? 'friends' : 'private',
        links: cleanLinks(links),
      })
      .eq('user_id', authUser.id)
    onSaved()
    onClose()
  }

  return (
    <ModalShell label="Edit profile" onClose={onClose} widthClass="sm:max-w-lg">
      <div className="p-4 sm:p-5">
        <h2 className="font-display text-[18px] font-medium text-fg">Edit profile</h2>
        <p className="mt-0.5 text-[12px] text-subtle">
          This is what a classmate sees at concordiatracker.com/@{user.handle}
        </p>

        {!loaded ? (
          <p className="flex items-center gap-2 py-10 text-[13px] text-subtle">
            <Loader2 size={15} className="animate-spin" aria-hidden />
            Loading your profile
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <Field label="Display name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="Your name"
                className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13px] text-fg outline-none transition-colors placeholder:text-subtle focus:border-accent"
              />
            </Field>

            <Field label="Bio" hint="A line or two. Select some words to link them.">
              <BioField
                value={bio}
                onChange={setBio}
                maxLength={280}
                rows={3}
                placeholder="A line or two about you…"
              />
            </Field>

            <Field label="Links" hint="A handle or a full URL both work.">
              <div className="grid gap-2 sm:grid-cols-2">
                {LINK_FIELDS.map((f) => (
                  <label key={f.key} className="block">
                    <span className="mb-1 block text-[11px] text-subtle">{f.label}</span>
                    <input
                      value={links[f.key] ?? ''}
                      onChange={(e) => setLinks((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      maxLength={200}
                      className="w-full rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-[12.5px] text-fg outline-none transition-colors placeholder:text-subtle focus:border-accent"
                    />
                  </label>
                ))}
              </div>
            </Field>

            {/* THE PROMPTS LIVE HERE NOW, not on the profile.
                They were a "Fill this out" block under someone's own profile —
                which put a to-do list on the page whose whole job is to show
                what the profile LOOKS LIKE. You cannot judge your own bio with
                three suggestions stapled under it. This is the screen where
                you are already changing things. */}
            <Prompts hasBlueprints={hasBlueprints} onNavigate={onClose} />

            <div className="space-y-1 rounded-xl border border-border bg-surface-2/40 p-1">
              <Toggle
                checked={pub}
                onChange={setPub}
                label="Public profile"
                body="Off means the page exists only for you."
              />
              {/* TWO THINGS YOU CAN SHOW, one switch each. They are not
                  degrees of the same setting: your major says which building
                  you are in and your schedule says when you are in it, and
                  somebody can reasonably want the first without the second.

                  "Show my classes" used to be a third. The class list came
                  off the profile, and a switch that governs nothing visible
                  is worse than no switch — `courses_public` stays in the
                  database, unread, so nothing has to be migrated if the list
                  ever comes back. */}
              <Toggle
                checked={programPub}
                onChange={setProgramPub}
                label="Show my major"
                body="The line under your name. Off hides it from everyone."
              />
              <Toggle
                checked={scheduleFriends}
                onChange={setScheduleFriends}
                label="Show my schedule to people I follow back"
                body="Times and rooms only — never a grade, and never to a stranger."
              />
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-[13px] text-muted transition-colors duration-150 hover:text-fg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!loaded || saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-60"
          >
            {saving && <Loader2 size={13} className="animate-spin" aria-hidden />}
            Save
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline gap-2">
        <span className="text-[12.5px] font-medium text-fg">{label}</span>
        {hint && <span className="text-[11px] text-subtle">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  body,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  body: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-medium text-fg">{label}</span>
        <span className="block text-[11px] leading-relaxed text-subtle">{body}</span>
      </span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

/**
 * The two things worth doing next, and only when they are actually undone.
 *
 * A suggestion that stays on screen after you have done it stops being a
 * suggestion and becomes furniture — which is why "upload an outline"
 * disappears once you have, and there is no row for anything that is already
 * covered by a field on this form.
 */
function Prompts({
  hasBlueprints,
  onNavigate,
}: {
  hasBlueprints: boolean
  onNavigate: () => void
}) {
  if (hasBlueprints) return null
  return (
    <Link
      to="/app/courses/blueprints"
      onClick={onNavigate}
      className="flex items-start gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5 transition-colors duration-150 hover:border-accent"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-fg">Upload an outline</span>
        <span className="block text-[11.5px] leading-relaxed text-subtle">
          Share a syllabus and the next student in your section imports it in one click. It shows
          on your profile.
        </span>
      </span>
      <ChevronRight size={15} className="mt-0.5 shrink-0 text-subtle" aria-hidden />
    </Link>
  )
}
