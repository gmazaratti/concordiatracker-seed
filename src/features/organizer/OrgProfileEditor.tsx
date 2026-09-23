import { useState } from 'react'
import { LangTabs } from '@/components/LangTabs'
import { mergeTranslations } from '@/lib/localized'
import type { Lang } from '@/i18n/i18n'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, Check, ExternalLink } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { orgSlug, type EventOrg, type OrgLinks, type SocialKey } from '@/data/community'
import { Button } from '@/components/ui/Button'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { ImageUploadField } from '@/components/ui/ImageUploadField'
import { OrgLogo } from '@/features/community/OrgLogo'
import { VerifiedBadge } from '@/features/community/VerifiedBadge'
import { SocialFieldIcon } from '@/features/community/SocialLinks'
import { ProfileLinksRow } from '@/features/community/ProfileLinksRow'
import { SOCIAL_FIELDS, orgProfileLinks } from '@/features/community/social'
import { BioField } from '@/components/ui/BioField'
import { RichBio } from '@/components/RichBio'

const field =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

/** `/organizer/profile` — edit the org profile students see (name, handle, bio,
 * logo, banner, brand colour). Writes through `updateOrgProfile`; a live preview
 * mirrors the public org-profile header. */
export function OrgProfileEditor() {
  const { currentOrg, updateOrgProfile, orgViewerPerms } = useTeacher()
  if (!currentOrg) return <Navigate to="/organizer" replace />
  if (!orgViewerPerms.edit_profile) return <Navigate to="/organizer" replace />

  return <ProfileForm org={currentOrg.org} approved={currentOrg.status === 'approved'} save={updateOrgProfile} />
}

function ProfileForm({
  org,
  approved,
  save,
}: {
  org: EventOrg
  approved: boolean
  save: (patch: Partial<EventOrg>) => void
}) {
  const [name, setName] = useState(org.name)
  const [handle, setHandle] = useState(org.handle)
  const [bio, setBio] = useState(org.bio)
  // The bio is the one field on this page with a language. A name, a colour
  // and a link do not, so the tabs govern the bio alone rather than the form.
  const [lang, setLang] = useState<Lang>('en')
  const [frBio, setFrBio] = useState(org.translations?.fr?.bio ?? '')
  const [logo, setLogo] = useState(org.logo ?? '')
  const [banner, setBanner] = useState(org.banner ?? '')
  const [color, setColor] = useState(org.color)
  const [links, setLinks] = useState<OrgLinks>(org.links ?? {})
  const [saved, setSaved] = useState(false)

  function touch() {
    setSaved(false)
  }
  function setLink(key: SocialKey, val: string) {
    setLinks((prev) => ({ ...prev, [key]: val }))
    touch()
  }
  /** The title is stored in a sibling map, so a club that never sets one has
   *  a links object identical to the one it has always had. */
  function setTitle(key: SocialKey, val: string) {
    setLinks((prev) => ({ ...prev, titles: { ...prev.titles, [key]: val } }))
    touch()
  }
  function cleanLinks(): OrgLinks {
    const out: OrgLinks = {}
    const titles: NonNullable<OrgLinks['titles']> = {}
    for (const f of SOCIAL_FIELDS) {
      const v = links[f.key]?.trim()
      if (!v) continue
      out[f.key] = v
      // A title with no link behind it is dropped with it — and a blank one
      // is dropped outright rather than stored as "", so the profile falls
      // back to the host instead of rendering an empty hyperlink.
      const t = links.titles?.[f.key]?.trim()
      if (t) titles[f.key] = t
    }
    if (Object.keys(titles).length > 0) out.titles = titles
    return out
  }
  function onSave() {
    const h = handle.trim().startsWith('@') ? handle.trim() : `@${handle.trim()}`
    save({
      name: name.trim() || org.name,
      handle: h,
      bio: bio.trim(),
      logo: logo.trim() || undefined,
      banner: banner.trim() || undefined,
      color,
      links: cleanLinks(),
      // mergeTranslations DROPS a blank, so clearing the French version
      // restores the fallback rather than publishing an empty bio.
      translations: mergeTranslations(org.translations, 'fr', { bio: frBio.trim() }),
    })
    setSaved(true)
  }

  const preview: EventOrg = {
    ...org,
    name,
    handle,
    bio,
    logo: logo.trim() || undefined,
    banner: banner.trim() || undefined,
    color,
    links: cleanLinks(),
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-6">
      <Link
        to="/organizer"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-fg"
      >
        <ArrowLeft size={15} aria-hidden />
        Dashboard
      </Link>

      <h1 className="font-display text-[22px] leading-tight font-semibold text-fg">Org profile</h1>
      <p className="text-[13px] text-subtle">This is what students see on your Community profile.</p>

      {/* Live preview header */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface">
        <div
          className="h-24 w-full bg-cover bg-center"
          style={banner.trim() ? { backgroundImage: `url(${banner.trim()})` } : { backgroundColor: color }}
        />
        <div className="px-4 pb-4">
          <div className="-mt-8 flex items-end gap-3">
            <OrgLogo org={preview} className="size-16 ring-4 ring-surface" rounded="rounded-full" textClass="text-[20px]" />
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <h2 className="font-display text-[18px] font-semibold text-fg">{name || 'Your org'}</h2>
            {approved && <VerifiedBadge size={15} />}
          </div>
          <p className="text-[12px] text-subtle">{handle || '@handle'}</p>
          <RichBio text={bio} className="mt-1.5 text-[13px] text-muted" />
          {/* The same row the public profile draws, so a title typed below
              shows up here in the words students will read. */}
          <ProfileLinksRow links={orgProfileLinks(preview.links)} />
        </div>
      </div>

      {/* Fields */}
      <div className="mt-5 flex flex-col gap-3.5">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Org name">
            <input value={name} onChange={(e) => { setName(e.target.value); touch() }} className={field} />
          </Field>
          <Field label="Handle">
            <input value={handle} onChange={(e) => { setHandle(e.target.value); touch() }} placeholder="@yourclub" className={field} />
          </Field>
        </div>

        <Field label="Bio">
          <LangTabs
            className="mb-2"
            value={lang}
            onChange={setLang}
            filled={frBio.trim() ? ['fr'] : []}
            hint={lang === 'fr' ? 'Leave this blank and French readers see the English bio.' : undefined}
          />
          <BioField
            value={lang === 'fr' ? frBio : bio}
            onChange={(next) => {
              if (lang === 'fr') setFrBio(next)
              else setBio(next)
              touch()
            }}
            rows={3}
            maxLength={600}
            placeholder={lang === 'fr' ? 'Une courte description de votre organisation.' : 'A short description of your org.'}
          />
        </Field>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <ImageUploadField
            label="Logo"
            hint="empty = initials"
            value={logo}
            onChange={(v) => { setLogo(v); touch() }}
            kind="logo"
          />
          <ImageUploadField
            label="Banner"
            hint="empty = brand colour"
            value={banner}
            onChange={(v) => { setBanner(v); touch() }}
            kind="banner"
          />
        </div>

        <Field label="Brand colour" hint="Used for the logo block + event banner fallback.">
          <ColorPicker value={color} onChange={(c) => { setColor(c); touch() }} ariaLabel="Brand colour" />
        </Field>

        {/* Social + custom links */}
        <div>
          <h2 className="mt-2 mb-2.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
            Links
          </h2>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {SOCIAL_FIELDS.map((f) => (
              <Field key={f.key} label={f.label}>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 text-subtle focus-within:border-accent">
                  <SocialFieldIcon field={f.key} size={15} />
                  <input
                    value={links[f.key] ?? ''}
                    onChange={(e) => setLink(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full bg-transparent py-2 text-[13px] text-fg placeholder:text-subtle focus:outline-none"
                  />
                </div>
                {/* WHAT THE LINK IS CALLED, shown only once there is a link to
                    call something: an empty title box above an empty URL box
                    is two empty boxes asking the same question. Left blank,
                    the profile shows the host. */}
                {links[f.key]?.trim() && (
                  <input
                    value={links.titles?.[f.key] ?? ''}
                    onChange={(e) => setTitle(f.key, e.target.value)}
                    maxLength={40}
                    placeholder={`Link title — e.g. "${f.titleHint}"`}
                    aria-label={`${f.label} — title`}
                    className="mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-[12.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
                  />
                )}
              </Field>
            ))}
          </div>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Button onClick={onSave} disabled={saved}>
            {saved ? (<><Check size={15} aria-hidden /> Saved</>) : 'Save profile'}
          </Button>
          {approved && (
            <Link
              to={`/app/community/org/${orgSlug(preview)}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
            >
              <ExternalLink size={14} aria-hidden />
              View public profile
            </Link>
          )}
        </div>
        {!approved && (
          <p className="text-[12px] text-subtle">
            Your public profile goes live once an admin approves your org.
          </p>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  info,
  children,
}: {
  label: string
  hint?: string
  info?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-[12px] font-medium text-muted">
        {label}
        {info}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-subtle">{hint}</span>}
    </label>
  )
}
