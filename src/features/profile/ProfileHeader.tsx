import { useEffect, useState } from 'react'
import { Bell, BellRing, GraduationCap, LifeBuoy, Link2, Pencil, Share2 } from 'lucide-react'
import { VerifiedBadge } from '@/features/community/VerifiedBadge'
import { SocialFieldIcon } from '@/features/community/SocialLinks'
import { badgeForPerson } from './badges'
import { useCommunityData } from '@/app/providers/community-data'
import { linkHref, type ProfileLinks } from '@/lib/social'
import {
  dmMessage,
  profileSocial,
  setFollow,
  type ProfileSocial,
} from '@/lib/social-graph'
import { FollowListModal, type FollowListKind } from './FollowListModal'
import { cn } from '@/lib/cn'

/**
 * The profile header — Instagram's shape, our colours.
 *
 * WHY THE THREE COUNTS ARE Orgs / Followers / Following. Instagram leads with
 * posts because posts are the product. Nobody posts here, so the first number
 * is the clubs they follow — which is the closest thing this app has to "what
 * are you into", and the only one of the three that says something about a
 * student rather than about their popularity.
 *
 * THE CATEGORY LINE IS THEIR MAJOR. Instagram puts a business category above
 * the bio in a different colour; the equivalent fact here is what somebody is
 * studying, which is also the single most useful thing on a student profile.
 *
 * ONE COMPONENT FOR BOTH LAYOUTS. Mobile stacks (avatar and counts on one
 * row, everything under it); desktop puts a large avatar left and the whole
 * block right of it. Two components would drift, and the difference is a
 * grid template, not a different page.
 */
export function ProfileHeader({
  handle,
  name,
  avatarUrl,
  program,
  bio,
  links,
  isSelf,
  isPublic,
  role,
  onEdit,
  onMessage,
  onHelp,
}: {
  handle: string
  name?: string
  avatarUrl?: string
  program?: string
  bio?: string
  links: ProfileLinks
  isSelf: boolean
  isPublic: boolean
  /** "Founder", "Administrator", "Organizer" — shown beside the seal. */
  role?: string
  onEdit: () => void
  onMessage: () => void
  /** Only passed on the support account — a real ticket, not a DM. */
  onHelp?: () => void
}) {
  const { orgNameByOwner } = useCommunityData()
  const [social, setSocial] = useState<ProfileSocial | null>(null)
  const [list, setList] = useState<FollowListKind | null>(null)
  const [notify, setNotify] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    void profileSocial(handle).then((s) => alive && setSocial(s))
    return () => {
      alive = false
    }
  }, [handle])

  const badge = badgeForPerson(handle, social ? orgNameByOwner[social.userId] : undefined)
  const following = social?.iFollow ?? false

  const toggleFollow = async () => {
    if (!social || busy) return
    setBusy(true)
    const next = !following
    setSocial({
      ...social,
      iFollow: next,
      followers: Math.max(0, social.followers + (next ? 1 : -1)),
    })
    const ok = await setFollow(handle, next)
    if (!ok) void profileSocial(handle).then(setSocial)
    setBusy(false)
  }

  const dmWhy = dmMessage(social?.dmReason ?? null)

  return (
    <header className="pt-1">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-10">
        <Avatar name={name} handle={handle} url={avatarUrl} />

        <div className="min-w-0 flex-1">
          {/* Handle, seal and role — the identity line. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="text-[20px] leading-tight font-semibold text-fg">{handle}</h1>
            {badge && <VerifiedBadge size={16} tone={badge.tone} label={badge.label} />}
            {role && (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                {role}
              </span>
            )}
          </div>
          {name && <p className="mt-0.5 text-[13.5px] text-subtle">{name}</p>}

          <Counts social={social} onOpen={setList} />

          {/* The category line, in its own colour and weight — their major. */}
          {isPublic && program && (
            <p className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-accent">
              <GraduationCap size={14} aria-hidden />
              {program}
            </p>
          )}

          {/* Three lines, then it stops. A profile is a summary; anything
              longer belongs on a page of their own. */}
          {isPublic && bio && (
            <p className="mt-1 line-clamp-3 max-w-xl text-[13.5px] leading-relaxed whitespace-pre-line text-fg/90">
              {bio}
            </p>
          )}

          {isPublic && <LinkRow links={links} />}

          <Mutuals social={social} />

          <Actions
            isSelf={isSelf}
            following={following}
            busy={busy}
            dmWhy={dmWhy}
            notify={notify}
            onFollow={() => void toggleFollow()}
            onMessage={onMessage}
            onEdit={onEdit}
            onNotify={() => setNotify((v) => !v)}
            handle={handle}
            onHelp={onHelp}
          />
        </div>
      </div>

      {list && <FollowListModal handle={handle} kind={list} onClose={() => setList(null)} />}
    </header>
  )
}

/** Orgs · Followers · Following. Each one opens the list behind it. */
function Counts({
  social,
  onOpen,
}: {
  social: ProfileSocial | null
  onOpen: (k: FollowListKind) => void
}) {
  const orgs = social?.orgs ?? 0
  const followers = social?.followers ?? 0
  const items: { kind: FollowListKind; label: string; n: number }[] = [
    // Singular when it is one. "1 orgs" next to "1 followers" is the detail
    // that makes a page read as generated rather than written.
    { kind: 'orgs', label: orgs === 1 ? 'org' : 'orgs', n: orgs },
    { kind: 'followers', label: followers === 1 ? 'follower' : 'followers', n: followers },
    { kind: 'following', label: 'following', n: social?.following ?? 0 },
  ]
  return (
    <div className="mt-3 flex items-center gap-5">
      {items.map((i) => (
        <button
          key={i.kind}
          type="button"
          onClick={() => onOpen(i.kind)}
          className="text-[13.5px] text-muted transition-colors duration-150 hover:text-fg"
        >
          <span className="font-semibold text-fg tabular-nums">{i.n}</span> {i.label}
        </button>
      ))}
    </div>
  )
}

/** "Followed by A, B and 4 others", with up to three faces. */
function Mutuals({ social }: { social: ProfileSocial | null }) {
  if (!social || social.mutualsTotal === 0) return null
  const shown = social.mutuals
  const names = shown.slice(0, 2).map((m) => m.name || m.handle)
  const rest = social.mutualsTotal - names.length
  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="flex -space-x-2">
        {shown.map((m) =>
          m.avatar_url ? (
            <img
              key={m.handle}
              src={m.avatar_url}
              alt=""
              className="size-6 rounded-full bg-surface-2 object-cover ring-2 ring-canvas"
            />
          ) : (
            <span
              key={m.handle}
              className="grid size-6 place-items-center rounded-full bg-surface-2 text-[9px] font-semibold text-muted ring-2 ring-canvas"
            >
              {(m.name || m.handle).slice(0, 2).toUpperCase()}
            </span>
          ),
        )}
      </span>
      <p className="min-w-0 text-[12.5px] text-subtle">
        Followed by{' '}
        <span className="font-medium text-fg">{names.join(', ')}</span>
        {rest > 0 && ` and ${rest} other${rest === 1 ? '' : 's'}`}
      </p>
    </div>
  )
}

function LinkRow({ links }: { links: ProfileLinks }) {
  const website = links.website
  // Everything except the website, in a fixed order so the row does not
  // reshuffle when somebody adds one.
  const socials = (['instagram', 'x', 'linkedin'] as const).filter((k) => links[k])
  if (!website && socials.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {/* A custom link reads as a link, the way it does on Instagram. */}
      {website && (
        <a
          href={linkHref('website', website) ?? '#'}
          target="_blank"
          rel="noreferrer noopener nofollow ugc"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-info hover:underline"
        >
          <Link2 size={13} aria-hidden />
          {website.replace(/^https?:\/\//i, '').replace(/\/+$/, '')}
        </a>
      )}
      {socials.map((k) => {
        const href = linkHref(k, links[k] as string)
        if (!href) return null
        return (
          <a
            key={k}
            href={href}
            target="_blank"
            rel="noreferrer noopener nofollow ugc"
            aria-label={`${k} — opens in a new tab`}
            title={k}
            className="grid size-7 place-items-center rounded-lg border border-border text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
          >
            {/* The hand-rolled brand glyphs the org profiles use — lucide
                dropped its brand icons, and a second set would drift. */}
            <SocialFieldIcon field={k} size={13} />
          </a>
        )
      })}
    </div>
  )
}

function Actions({
  isSelf,
  following,
  busy,
  dmWhy,
  notify,
  onFollow,
  onMessage,
  onEdit,
  onNotify,
  handle,
  onHelp,
}: {
  isSelf: boolean
  following: boolean
  busy: boolean
  dmWhy: string | null
  notify: boolean
  onFollow: () => void
  onMessage: () => void
  onEdit: () => void
  onNotify: () => void
  handle: string
  onHelp?: () => void
}) {
  const [copied, setCopied] = useState(false)

  if (isSelf) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Btn onClick={onEdit} icon={Pencil}>
          Edit profile
        </Btn>
        <Btn
          icon={Share2}
          onClick={() => {
            void navigator.clipboard
              ?.writeText(`${window.location.origin}/@${handle}`)
              .then(() => setCopied(true))
              .catch(() => {})
          }}
        >
          {copied ? 'Link copied' : 'Share profile'}
        </Btn>
      </div>
    )
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onFollow}
          className={cn(
            'min-w-[104px] flex-1 rounded-lg px-4 py-2 text-[13.5px] font-semibold transition-colors duration-150 disabled:opacity-60 sm:flex-none',
            following
              ? 'border border-border bg-surface text-fg hover:border-border-strong'
              : 'bg-accent text-accent-contrast hover:bg-accent-hover',
          )}
        >
          {following ? 'Following' : 'Follow'}
        </button>
        <button
          type="button"
          onClick={onMessage}
          disabled={!!dmWhy}
          title={dmWhy ?? undefined}
          className="min-w-[104px] flex-1 rounded-lg border border-border bg-surface px-4 py-2 text-[13.5px] font-semibold text-fg transition-colors duration-150 hover:border-border-strong disabled:opacity-50 sm:flex-none"
        >
          Message
        </button>
        {/* Replaces Instagram's add-person icon. Notifications for what this
            account does — a club posting an outline is the case that matters,
            and following alone should not have to mean "tell me everything". */}
        <button
          type="button"
          onClick={onNotify}
          aria-pressed={notify}
          aria-label={notify ? 'Notifications on' : 'Notify me about this account'}
          title={notify ? 'Notifications on' : 'Notify me about this account'}
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-lg border transition-colors duration-150',
            notify
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-border bg-surface text-muted hover:text-fg',
          )}
        >
          {notify ? <BellRing size={15} aria-hidden /> : <Bell size={15} aria-hidden />}
        </button>
      </div>
      {/* Says WHY, from the recipient's side. A disabled button with no
          explanation is the thing people file a bug about. */}
      {dmWhy && <p className="mt-1.5 text-[11.5px] leading-relaxed text-subtle">{dmWhy}</p>}
      {onHelp && (
        <button
          type="button"
          onClick={onHelp}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12.5px] font-medium text-fg transition-colors duration-150 hover:border-accent"
        >
          <LifeBuoy size={13} className="text-accent" aria-hidden />
          Need help?
        </button>
      )}
    </div>
  )
}

function Btn({
  children,
  icon: Icon,
  onClick,
}: {
  children: React.ReactNode
  icon: typeof Pencil
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-[13.5px] font-semibold text-fg transition-colors duration-150 hover:border-border-strong sm:flex-none"
    >
      <Icon size={14} aria-hidden />
      {children}
    </button>
  )
}

function Avatar({ name, handle, url }: { name?: string; handle: string; url?: string }) {
  const initials = (name ?? handle).slice(0, 2).toUpperCase()
  return url ? (
    <img
      src={url}
      alt=""
      referrerPolicy="no-referrer"
      className="size-20 shrink-0 rounded-full bg-surface-2 object-cover sm:size-36"
    />
  ) : (
    <span className="grid size-20 shrink-0 place-items-center rounded-full bg-surface-2 font-display text-[26px] font-semibold text-muted sm:size-36 sm:text-[44px]">
      {initials}
    </span>
  )
}

/** The tab strip under the header. Outlines is the one that has content;
 *  the other two are named and empty rather than invented — a tab that does
 *  nothing is better than a tab that pretends. */
export function ProfileTabs({
  active,
  onChange,
  tabs,
}: {
  active: string
  onChange: (id: string) => void
  tabs: { id: string; label: string; icon: typeof Pencil; count?: number }[]
}) {
  return (
    <div className="mt-6 flex border-t border-border">
      {tabs.map((t) => {
        const Icon = t.icon
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-pressed={active === t.id}
            className={cn(
              '-mt-px flex flex-1 items-center justify-center gap-1.5 border-t-2 py-3 text-[11px] font-semibold tracking-wide uppercase transition-colors duration-150',
              active === t.id
                ? 'border-fg text-fg'
                : 'border-transparent text-subtle hover:text-muted',
            )}
          >
            <Icon size={15} aria-hidden />
            <span className="hidden sm:inline">{t.label}</span>
            {t.count != null && t.count > 0 && (
              <span className="tabular-nums text-subtle">{t.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
