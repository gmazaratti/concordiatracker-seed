import { useEffect, useState } from 'react'
import { Bell, BellRing, GraduationCap, LifeBuoy, Pencil, Share2 } from 'lucide-react'
import { CachedImg } from '@/components/ui/CachedImg'
import { VerifiedBadge } from '@/features/community/VerifiedBadge'
import { ProfileLinksRow } from '@/features/community/ProfileLinksRow'
import { personProfileLinks } from '@/features/community/social'
import { badgeForPerson } from './badges'
import { useCommunityData } from '@/app/providers/community-data'
import { type ProfileLinks } from '@/lib/social'
import {
  cachedProfileSocial,
  dmMessage,
  profileSocial,
  setFollow,
  type ProfileSocial,
} from '@/lib/social-graph'
import { FollowListPage, type FollowListKind } from './FollowListPage'
import { RichBio } from '@/components/RichBio'
import { cn } from '@/lib/cn'

/**
 * The profile header, laid out to match Instagram's.
 *
 * THE SHAPE, and it is not arbitrary: AVATAR LEFT, and to the right of it the
 * name with the three counts beneath — so the identity block is one object
 * about 90px tall instead of five stacked rows. Everything that is prose (the
 * category line, the bio, the links, who you both know) runs full width UNDER
 * that block, where a long line has the whole screen rather than half of it.
 * Then the actions, then the tabs.
 *
 * The first version stacked the avatar on its own row above the name, which
 * cost roughly 120px of a phone screen before a single fact about the person.
 *
 * WHY THE THREE COUNTS ARE Orgs / Followers / Following. Instagram leads with
 * posts because posts are its product. Students do not post here — clubs do —
 * so the first number is the clubs they follow, which is the only one of the
 * three that says something about a person rather than about their reach.
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
  /** "Founder", "Administrator", "Organizer" — shown beside the name. */
  role?: string
  onEdit: () => void
  onMessage: () => void
  /** Only passed on the support account — a real ticket, not a DM. */
  onHelp?: () => void
}) {
  const { orgNameByOwner } = useCommunityData()
  // Seeded from the last answer so the counts and the Follow button are
  // already right on the first frame of a profile you have opened before.
  const [social, setSocial] = useState<ProfileSocial | null>(() => cachedProfileSocial(handle))
  // Same reason as `usePublicProfile`: the initialiser above runs once, so
  // moving between two profiles showed the first one's counts on the second.
  const [socialFor, setSocialFor] = useState(handle)
  if (socialFor !== handle) {
    setSocialFor(handle)
    setSocial(cachedProfileSocial(handle))
  }
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
    <header>
      {/* The identity block: avatar left, name + counts right. */}
      <div className="flex items-start gap-5 sm:gap-10">
        <Avatar name={name} handle={handle} url={avatarUrl} />
        <div className="min-w-0 flex-1 pt-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="text-[17px] leading-tight font-semibold text-fg">{name ?? handle}</h1>
            {badge && <VerifiedBadge size={15} tone={badge.tone} label={badge.label} />}
            {role && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
                {role}
              </span>
            )}
          </div>
          <Counts social={social} onOpen={setList} />
        </div>
      </div>

      {/* Prose, full width. */}
      <div className="mt-3.5">
        {isPublic && program && (
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-accent">
            <GraduationCap size={14} aria-hidden />
            {program}
          </p>
        )}
        {/* Links in a bio are live — see RichBio for why the format is plain
            text and why only http(s) ever becomes an anchor. */}
        {isPublic && bio && (
          <RichBio text={bio} className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-fg" />
        )}
        {isPublic && <ProfileLinksRow links={personProfileLinks(links)} />}
        <Mutuals social={social} />
      </div>

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

      {list && <FollowListPage handle={handle} kind={list} onClose={() => setList(null)} />}
    </header>
  )
}

/** Orgs · Followers · Following, number over word the way Instagram sets them
 *  — the number is what you scan, the word only labels it. */
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
    { kind: 'orgs', label: orgs === 1 ? 'org' : 'orgs', n: orgs },
    { kind: 'followers', label: followers === 1 ? 'follower' : 'followers', n: followers },
    { kind: 'following', label: 'following', n: social?.following ?? 0 },
  ]
  /*
   * THREE EQUAL COLUMNS, FILLING THE WIDTH. They used to be left-packed on a
   * `gap-6`, so the row occupied about half the space beside the avatar and
   * read as cramped next to an 86px face. The reference gives each count a
   * third of the row and centres it, which is what makes the block feel
   * deliberate rather than squeezed — and the numbers are what you scan, so
   * they carry the size.
   *
   * On a wide screen the row is left-aligned instead: stretching three counts
   * across 700px of desktop puts them so far apart they stop reading as a
   * group.
   */
  return (
    <div className="mt-2.5 flex items-start sm:gap-9">
      {items.map((i) => (
        <button
          key={i.kind}
          type="button"
          onClick={() => onOpen(i.kind)}
          className="flex-1 text-center transition-opacity duration-150 active:opacity-60 sm:flex-none sm:text-left"
        >
          <span className="block text-[19px] leading-tight font-semibold text-fg tabular-nums sm:text-[17px]">
            {i.n}
          </span>
          <span className="block text-[13.5px] leading-tight text-muted sm:text-[13px]">
            {i.label}
          </span>
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
    <div className="mt-2.5 flex items-center gap-2">
      <span className="flex -space-x-2">
        {shown.map((m) =>
          m.avatar_url ? (
            <img
              key={m.handle}
              src={m.avatar_url}
              alt=""
              className="size-5 rounded-full bg-surface-2 object-cover ring-2 ring-canvas"
            />
          ) : (
            <span
              key={m.handle}
              className="grid size-5 place-items-center rounded-full bg-surface-2 text-[8px] font-semibold text-muted ring-2 ring-canvas"
            >
              {(m.name || m.handle).slice(0, 2).toUpperCase()}
            </span>
          ),
        )}
      </span>
      <p className="min-w-0 text-[12px] text-subtle">
        Followed by <span className="font-medium text-fg">{names.join(', ')}</span>
        {rest > 0 && ` and ${rest} other${rest === 1 ? '' : 's'}`}
      </p>
    </div>
  )
}


/** One row of equal-width flat buttons, the way Instagram sets them. */
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
  const flat =
    'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-[13.5px] font-semibold text-fg transition-colors duration-150 hover:bg-surface active:opacity-70'

  if (isSelf) {
    return (
      <div className="mt-4 flex items-center gap-2">
        <button type="button" onClick={onEdit} className={flat}>
          <Pencil size={14} aria-hidden />
          Edit profile
        </button>
        <button
          type="button"
          className={flat}
          onClick={() => {
            void navigator.clipboard
              ?.writeText(`${window.location.origin}/@${handle}`)
              .then(() => setCopied(true))
              .catch(() => {})
          }}
        >
          <Share2 size={14} aria-hidden />
          {copied ? 'Link copied' : 'Share profile'}
        </button>
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
            'min-w-0 flex-1 rounded-lg px-3 py-2 text-[13.5px] font-semibold transition-colors duration-150 disabled:opacity-60',
            following
              ? 'bg-surface-2 text-fg hover:bg-surface'
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
          className={cn(flat, 'disabled:opacity-50')}
        >
          Message
        </button>
        {/* Replaces Instagram's add-person icon. Notifications for what this
            account does — following alone should not have to mean "tell me
            everything". */}
        <button
          type="button"
          onClick={onNotify}
          aria-pressed={notify}
          aria-label={notify ? 'Notifications on' : 'Notify me about this account'}
          title={notify ? 'Notifications on' : 'Notify me about this account'}
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-lg transition-colors duration-150',
            notify ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted hover:text-fg',
          )}
        >
          {notify ? <BellRing size={15} aria-hidden /> : <Bell size={15} aria-hidden />}
        </button>
      </div>
      {dmWhy && <p className="mt-1.5 text-[11.5px] leading-relaxed text-subtle">{dmWhy}</p>}
      {onHelp && (
        <button
          type="button"
          onClick={onHelp}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-[12.5px] font-medium text-fg transition-colors duration-150 hover:bg-surface"
        >
          <LifeBuoy size={13} className="text-accent" aria-hidden />
          Need help?
        </button>
      )}
    </div>
  )
}

function Avatar({ name, handle, url }: { name?: string; handle: string; url?: string }) {
  const [broken, setBroken] = useState(false)
  const initials = (name ?? handle).slice(0, 2).toUpperCase()
  // 86px and the first thing on the page: this is the one image on a profile
  // that absolutely cannot arrive late. See CachedImg.
  return url && !broken ? (
    <CachedImg
      src={url}
      eager
      onFailed={() => setBroken(true)}
      className="size-[86px] shrink-0 rounded-full bg-surface-2 object-cover"
    />
  ) : (
    <span className="grid size-[86px] shrink-0 place-items-center rounded-full bg-surface-2 font-display text-[28px] font-semibold text-muted">
      {initials}
    </span>
  )
}

/** The tab strip. Icons only, underlined on the active one — at three tabs the
 *  icons are unambiguous, and the words cost a row of height on the screen
 *  this page is actually read on. The label lives in `aria-label`. */
export function ProfileTabs({
  active,
  onChange,
  tabs,
}: {
  active: string
  onChange: (id: string) => void
  tabs: { id: string; label: string; icon: typeof Pencil; count?: number }[]
}) {
  /*
   * THE BAR SITS UNDER THE ICON. It was on top, which reads as the rule that
   * separates the tabs from the profile above rather than as a marker of
   * which tab you are on — and every app this borrows from underlines.
   */
  return (
    <div className="mt-5 flex border-t border-border">
      {tabs.map((t) => {
        const Icon = t.icon
        const on = active === t.id
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-pressed={on}
            aria-label={t.label}
            title={t.label}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 transition-colors duration-150',
              on ? 'border-fg text-fg' : 'border-transparent text-subtle hover:text-muted',
            )}
          >
            <Icon size={19} aria-hidden />
            {t.count != null && t.count > 0 && (
              <span className="text-[12.5px] tabular-nums">{t.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
