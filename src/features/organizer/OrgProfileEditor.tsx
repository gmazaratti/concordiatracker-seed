import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, Check, ExternalLink } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { orgSlug, type EventOrg, type OrgLinks } from '@/data/community'
import { Button } from '@/components/ui/Button'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { ImgbbHint } from '@/components/ui/InfoHint'
import { OrgLogo } from '@/features/community/OrgLogo'
import { VerifiedBadge } from '@/features/community/VerifiedBadge'
import { SocialLinks, SocialFieldIcon } from '@/features/community/SocialLinks'
import { SOCIAL_FIELDS } from '@/features/community/social'
import { cn } from '@/lib/cn'

const field =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

/** `/organizer/profile` — edit the org profile students see (name, handle, bio,
 * logo, banner, brand colour). Writes through `updateOrgProfile`; a live preview
 * mirrors the public org-profile header. */
export function OrgProfileEditor() {
  const { currentOrg, updateOrgProfile } = useTeacher()
  if (!currentOrg) return <Navigate to="/organizer" replace />

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
  const [logo, setLogo] = useState(org.logo ?? '')
  const [banner, setBanner] = useState(org.banner ?? '')
  const [color, setColor] = useState(org.color)
  const [links, setLinks] = useState<OrgLinks>(org.links ?? {})
  const [saved, setSaved] = useState(false)

  function touch() {
    setSaved(false)
  }
  function setLink(key: keyof OrgLinks, val: string) {
    setLinks((prev) => ({ ...prev, [key]: val }))
    touch()
  }
  function cleanLinks(): OrgLinks {
    const out: OrgLinks = {}
    for (const f of SOCIAL_FIELDS) {
      const v = links[f.key]?.trim()
      if (v) out[f.key] = v
    }
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
          {bio.trim() && <p className="mt-1.5 text-[13px] text-muted">{bio}</p>}
          <SocialLinks links={preview.links} className="mt-2.5 flex flex-wrap gap-2" />
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
          <textarea
            value={bio}
            onChange={(e) => { setBio(e.target.value); touch() }}
            rows={3}
            placeholder="A short description of your org."
            className={cn(field, 'resize-none')}
          />
        </Field>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Logo URL" hint="Square image. Empty = coloured initials." info={<ImgbbHint />}>
            <input value={logo} onChange={(e) => { setLogo(e.target.value); touch() }} placeholder="https://…" className={field} />
          </Field>
          <Field label="Banner URL" hint="Wide image. Empty = brand colour." info={<ImgbbHint />}>
            <input value={banner} onChange={(e) => { setBanner(e.target.value); touch() }} placeholder="https://…" className={field} />
          </Field>
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
