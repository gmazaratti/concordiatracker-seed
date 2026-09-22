import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ModalShell } from '@/command/ModalShell'
import { VerifiedBadge } from '../VerifiedBadge'
import { FollowButton } from '../FollowButton'
import type { Collaborator, FeedPost } from '@/lib/social-posts'
import { cn } from '@/lib/cn'

/** Handles are stored with the @; the header reads better without it. */
const slugOf = (h: string) => h.replace(/^@/, '')

/**
 * One account's tile — a real logo, or its brand colour with initials.
 *
 * Deliberately NOT `OrgLogo`: that takes a full `EventOrg`, and what the feed
 * has is the five fields the row carried. Inventing the rest to satisfy a type
 * would mean a bio and a banner that are not the club's.
 */
function Face({
  logo,
  color,
  glyph,
  name,
  className,
}: {
  logo: string | null
  color: string | null
  glyph: string | null
  name: string
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  if (logo && !broken) {
    return (
      <img
        src={logo}
        alt=""
        onError={() => setBroken(true)}
        className={cn('shrink-0 rounded-full bg-surface-2 object-cover', className)}
      />
    )
  }
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white',
        className,
      )}
      style={{ background: color ?? '#4b5563' }}
    >
      {(glyph || name.slice(0, 2)).toUpperCase()}
    </span>
  )
}

/**
 * The byline on a post, with or without a co-author.
 *
 * WITH ONE, IT IS TWO OVERLAPPING FACES AND "a and b" — the shape every
 * product that has this uses, and it is the shape for a reason: a co-authored
 * post has to be legible as ONE post by TWO accounts at a glance, which a
 * second row or a badge would not manage. The publisher is in front, because
 * the post is still theirs; the co-author sits behind and slightly right.
 *
 * THREE OR MORE COLLAPSES to "a and N others" rather than wrapping. The header
 * is one line at 390px and a third name would push the timestamp and the
 * follow button off it; the names are all in the sheet, one tap away.
 *
 * TAPPING EITHER NAME OPENS THE SHEET, not one of the profiles. With two
 * accounts on a line, a tap that silently picks one of them is a coin toss —
 * the sheet is the disambiguation, and it is where the follow buttons are.
 */
export function CollabHeader({
  post,
  onOpenSheet,
}: {
  post: FeedPost
  onOpenSheet: () => void
}) {
  const slug = slugOf(post.handle)
  const collabs = post.collaborators

  if (collabs.length === 0) {
    return (
      <Link to={`/app/community/org/${slug}`} className="flex min-w-0 items-center gap-2.5">
        <Face logo={post.logo} color={post.color} glyph={post.glyph} name={post.orgName} className="size-8" />
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[13.5px] font-semibold text-fg">{slug}</span>
          {post.verified && <VerifiedBadge size={13} />}
        </span>
      </Link>
    )
  }

  const first = collabs[0]
  const rest = collabs.length - 1

  return (
    <button
      type="button"
      onClick={onOpenSheet}
      aria-label={`Collaborators: ${slug} and ${slugOf(first.handle)}${rest > 0 ? ` and ${rest} more` : ''}`}
      className="flex min-w-0 items-center gap-2.5 text-left"
    >
      {/* 28px each with a 10px overlap: at 390px this costs 46px against the
          38px a single face takes, which the line can afford. Going smaller
          made the initials unreadable on the no-logo fallback. */}
      <span className="relative flex shrink-0 items-center" style={{ width: 46, height: 32 }}>
        <Face
          logo={first.logo}
          color={first.color}
          glyph={first.glyph}
          name={first.name}
          className="absolute left-[18px] size-7 ring-2 ring-canvas"
        />
        <Face
          logo={post.logo}
          color={post.color}
          glyph={post.glyph}
          name={post.orgName}
          className="absolute left-0 size-7 ring-2 ring-canvas"
        />
      </span>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-[13.5px] font-semibold text-fg">
          {slug}
          <span className="font-normal text-muted"> and </span>
          {rest > 0 ? `${rest + 1} others` : slugOf(first.handle)}
        </span>
        {post.verified && rest === 0 && <VerifiedBadge size={13} />}
      </span>
    </button>
  )
}

/**
 * The Collaborators sheet.
 *
 * Every account on the post, in the order the header names them, each with
 * the follow button — which is the reason to open it at all: you tapped two
 * names and want to do something about one of them.
 */
export function CollaboratorsSheet({
  post,
  onClose,
}: {
  post: FeedPost
  onClose: () => void
}) {
  const rows: (Collaborator & { author?: boolean })[] = [
    {
      orgId: post.orgId,
      handle: post.handle,
      name: post.orgName,
      logo: post.logo,
      color: post.color,
      glyph: post.glyph,
      verified: post.verified,
      author: true,
    },
    ...post.collaborators,
  ]

  return (
    <ModalShell label="Collaborators" onClose={onClose} widthClass="sm:max-w-sm">
      <div className="px-4 pt-1 pb-4">
        <h2 className="pb-2 text-center text-[15px] font-semibold text-fg">Collaborators</h2>
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.orgId} className="flex items-center gap-3 py-2.5">
              <Link to={`/app/community/org/${slugOf(r.handle)}`} onClick={onClose} className="shrink-0">
                <Face logo={r.logo} color={r.color} glyph={r.glyph} name={r.name} className="size-11" />
              </Link>
              <Link
                to={`/app/community/org/${slugOf(r.handle)}`}
                onClick={onClose}
                className="min-w-0 flex-1"
              >
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[14px] font-semibold text-fg">
                    {slugOf(r.handle)}
                  </span>
                  {r.verified && <VerifiedBadge size={13} />}
                </span>
                <span className="block truncate text-[12.5px] text-subtle">
                  {r.name}
                  {/* Says which one published it. Both names are on the post;
                      only one of them wrote it, and that is a fact somebody
                      opening this sheet is often here to check. */}
                  {r.author && <span className="text-muted"> · posted this</span>}
                </span>
              </Link>
              <FollowButton handle={r.handle} size="sm" className="shrink-0" />
            </li>
          ))}
        </ul>
      </div>
    </ModalShell>
  )
}
