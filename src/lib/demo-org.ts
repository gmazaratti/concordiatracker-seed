import type { ActivityEntry, OrgRoleDef, OrgPerms } from './org-roles'
import type { FeedPost, PostDraft, PostMedia } from './social-posts'
import type { DmCandidate, OrgMessage, OrgThread } from './org-messages'

/**
 * The demo organizer portal's sandbox — everything it shows, held in memory.
 *
 * THE BUG THIS EXISTS FOR: the demo org's id is the string `org-hack`, and the
 * Roles tab sent it to a function whose parameter is a uuid, so Postgres
 * answered "invalid input syntax for type uuid" and nothing loaded. The same
 * was true of Activity, Feed, Inbox and Overview — every screen that reads
 * the database by org id. A demo is supposed to write nothing real, so the
 * answer is not to invent a uuid for it but to never send it: every loader
 * checks `isDemoOrgId` first and answers from here.
 *
 * STATE LIVES FOR THE TAB. Edits in the demo stick while you look around and
 * are gone on reload, which is what "a sandbox: nothing you do is saved"
 * already promises on the sign-in screen.
 *
 * THE PICTURES ARE DRAWN, NOT DOWNLOADED. Stock photos read as fake the
 * moment a student sees one, and every real post beside them inherits the
 * doubt; a generated poster in a club's colours reads as what it is.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isDemoOrgId(id: string | null | undefined): boolean {
  return !!id && !UUID.test(id)
}

/* ── Drawn media ──────────────────────────────────────────────────────────── */

export function demoPoster(title: string, sub: string, a: string, b: string, w = 1080, h = 1350): PostMedia {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<circle cx="${w * 0.82}" cy="${h * 0.18}" r="${w * 0.28}" fill="#fff" opacity=".08"/>
<circle cx="${w * 0.12}" cy="${h * 0.9}" r="${w * 0.35}" fill="#000" opacity=".1"/>
<text x="${w * 0.08}" y="${h * 0.62}" font-family="Hanken Grotesk, Inter, sans-serif" font-weight="800" font-size="${w * 0.1}" fill="#fff">${esc(title)}</text>
<text x="${w * 0.08}" y="${h * 0.7}" font-family="Inter, sans-serif" font-weight="500" font-size="${w * 0.042}" fill="#fff" opacity=".85">${esc(sub)}</text>
</svg>`
  return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, w, h }
}

/* ── Roles ────────────────────────────────────────────────────────────────── */

const ALL: OrgPerms = {
  post_create: true, post_feed: true, post_edit: true, post_delete: true,
  event_create: true, event_update: true, draft_content: true, profile_edit: true,
  handle_change: true, view_insights: true, manage_team: true, roles_grant: true,
}

const roles = new Map<string, OrgRoleDef[]>()

function seedRoles(orgId: string): OrgRoleDef[] {
  const r = (id: string, name: string, color: string, icon: string, position: number, permissions: OrgPerms, extra: Partial<OrgRoleDef> = {}): OrgRoleDef => ({
    id: `${orgId}:${id}`, orgId, name, color, icon, position, permissions,
    canViewActivity: position >= 50, isOwner: false, systemKey: null, ...extra,
  })
  return [
    r('owner', 'Owner', '#e8b84b', 'Crown', 100, ALL, { isOwner: true, systemKey: 'owner', canViewActivity: true }),
    r('admin', 'Admin', '#8fb39a', 'Shield', 50, { ...ALL, handle_change: false }, { systemKey: 'admin' }),
    r('marketing', 'Marketing', '#ff7ab6', 'Megaphone', 30, { post_create: true, post_feed: true, post_edit: true, draft_content: true, view_insights: true }),
    r('events', 'Events', '#7ad3ff', 'CalendarDays', 25, { event_create: true, event_update: true, draft_content: true }),
    r('member', 'Member', '#9ca3af', 'User', 10, { draft_content: true }, { systemKey: 'member' }),
  ]
}

export function demoRoles(orgId: string): OrgRoleDef[] {
  if (!roles.has(orgId)) roles.set(orgId, seedRoles(orgId))
  return [...roles.get(orgId)!].sort((a, b) => b.position - a.position)
}

/** Roles handed out during this visit, by member id. */
const assigned = new Map<string, string>()

/** Which demo role a seeded member holds: whatever was handed out this visit,
 *  else the one the old three-value column implies. */
export function demoRoleIdFor(orgId: string, legacy: string, memberId?: string): string {
  const given = memberId ? assigned.get(memberId) : undefined
  if (given) return given
  return `${orgId}:${legacy === 'owner' ? 'owner' : legacy === 'admin' ? 'admin' : 'member'}`
}

export function demoAssignRole(memberId: string, roleId: string) {
  assigned.set(memberId, roleId)
}

export function demoSaveRole(orgId: string, role: Omit<OrgRoleDef, 'id' | 'orgId'> & { id?: string }): OrgRoleDef {
  const list = demoRoles(orgId)
  const saved: OrgRoleDef = { ...role, id: role.id ?? `${orgId}:custom-${Date.now().toString(36)}`, orgId }
  roles.set(orgId, [...list.filter((r) => r.id !== saved.id), saved])
  return saved
}

export function demoDeleteRole(orgId: string, roleId: string) {
  roles.set(orgId, demoRoles(orgId).filter((r) => r.id !== roleId || r.systemKey))
  // Whoever held it falls back to Member, as `delete_org_role` does.
  for (const [m, r] of assigned) if (r === roleId) assigned.set(m, `${orgId}:member`)
}

/* ── Activity ─────────────────────────────────────────────────────────────── */

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()

export function demoActivity(): ActivityEntry[] {
  const e = (h: number, name: string, action: string, detail = ''): ActivityEntry => ({
    id: `demo-act-${h}`, createdAt: hoursAgo(h), actorUser: `demo-${name.split(' ')[0].toLowerCase()}`,
    actorName: name, actorEmail: '', action, detail, entityType: null, entityId: null,
    revertedAt: null, canRevert: false,
  })
  return [
    e(2, 'Marc Tremblay', 'saved an event', 'title, location'),
    e(5, 'Wei Chen', 'started a draft post', 'Build night recap'),
    e(26, 'Priya Nair', 'updated the org profile', 'bio'),
    e(51, 'Priya Nair', 'gave Wei Chen the role Member', 'no role → Member'),
    e(98, 'Marc Tremblay', 'posted an event', 'ConUHacks IX'),
  ]
}

/* ── Posts and drafts ─────────────────────────────────────────────────────── */

interface DemoOrgFace {
  handle: string
  name: string
  color: string
  glyph: string
}

const posts = new Map<string, FeedPost[]>()
const drafts = new Map<string, PostDraft[]>()

function post(org: DemoOrgFace & { id: string }, id: string, caption: string, media: PostMedia[], hours: number, likes: number): FeedPost {
  return {
    id, orgId: org.id, handle: org.handle, orgName: org.name, logo: null, color: org.color, glyph: org.glyph,
    verified: true, caption, media, createdAt: hoursAgo(hours), likes, comments: Math.round(likes / 9),
    reposts: Math.round(likes / 20), iLike: false, iRepost: false, collaborators: [], place: null,
    placeUrl: null, eventId: null, publishAt: null, hideLikes: false, hideShares: false,
  }
}

export function demoPosts(orgId: string, face: DemoOrgFace): FeedPost[] {
  if (!posts.has(orgId)) {
    const o = { ...face, id: orgId }
    posts.set(orgId, [
      post(o, 'demo-post-1', 'Registration is open. 36 hours, free food, and more cables than anyone needs.', [demoPoster('ConUHacks IX', 'January · Hall building', '#1f2937', face.color)], 20, 312),
      post(o, 'demo-post-2', 'Thank you to everyone who came to the API workshop 💚', [demoPoster('Workshop recap', 'Building with public APIs', face.color, '#0f172a', 1080, 1080)], 76, 148),
    ])
  }
  return posts.get(orgId)!
}

export function demoDrafts(orgId: string): PostDraft[] {
  if (!drafts.has(orgId)) {
    drafts.set(orgId, [
      {
        id: 'demo-draft-1', caption: 'Mentor sign-ups for ConUHacks close Friday…', media: [demoPoster('Mentors wanted', 'Sign up by Friday', '#7c2d12', '#f59e0b', 1080, 1080)],
        createdAt: hoursAgo(5), authorUser: 'demo-wei', authorName: 'Wei Chen', lastEditedBy: 'demo-wei',
        lastEditedName: 'Wei Chen', lastEditedAt: hoursAgo(5),
        details: { place: '', placeUrl: '', eventId: null, audience: 'everyone', publishAt: null, hideLikes: false, hideShares: false },
      },
    ])
  }
  return drafts.get(orgId)!
}

export function demoAddPost(orgId: string, input: { caption: string; media: PostMedia[]; draft: boolean }) {
  if (input.draft) {
    demoDrafts(orgId).unshift({
      id: `demo-draft-${Date.now()}`, caption: input.caption, media: input.media, createdAt: hoursAgo(0),
      authorUser: 'demo-you', authorName: 'You', lastEditedBy: 'demo-you', lastEditedName: 'You', lastEditedAt: hoursAgo(0),
      details: { place: '', placeUrl: '', eventId: null, audience: 'everyone', publishAt: null, hideLikes: false, hideShares: false },
    })
    return
  }
  const list = posts.get(orgId)
  if (!list?.length) return
  list.unshift({ ...list[0], id: `demo-post-${Date.now()}`, caption: input.caption, media: input.media, createdAt: hoursAgo(0), likes: 0, comments: 0, reposts: 0 })
}

export function demoDiscardDraft(orgId: string, id: string) {
  drafts.set(orgId, demoDrafts(orgId).filter((d) => d.id !== id))
}

/** Anything the sandbox made. The database has never heard of these ids, and
 *  sending one to it is a 400 at best — the post layer answers for them. */
export const isDemoContentId = (id: string) => id.startsWith('demo-') || id.startsWith('filler-')

function draftOrg(id: string): string | undefined {
  for (const [org, list] of drafts) if (list.some((d) => d.id === id)) return org
}

export function demoSaveDraft(id: string, caption: string, media: PostMedia[], publish: boolean) {
  const org = draftOrg(id)
  const d = org ? demoDrafts(org).find((x) => x.id === id) : undefined
  if (!org || !d) return
  Object.assign(d, { caption, media, lastEditedBy: 'demo-you', lastEditedName: 'You', lastEditedAt: hoursAgo(0) })
  if (publish) demoPublishDraft(org, id)
}

export function demoDiscardDraftById(id: string) {
  const org = draftOrg(id)
  if (org) demoDiscardDraft(org, id)
}

export function demoDeletePost(id: string) {
  for (const [org, list] of posts) posts.set(org, list.filter((p) => p.id !== id))
}

export function demoPublishDraft(orgId: string, id: string) {
  const d = demoDrafts(orgId).find((x) => x.id === id)
  if (!d) return
  demoDiscardDraft(orgId, id)
  demoAddPost(orgId, { caption: d.caption, media: d.media, draft: false })
}

/* ── Filler clubs, for Preview mode ───────────────────────────────────────── */

const FILLER: (DemoOrgFace & { id: string; posts: [string, string, string, string, string][] })[] = [
  { id: 'filler-outdoors', handle: '@conu.outdoors', name: 'Concordia Outdoors', color: '#2f855a', glyph: 'CO',
    posts: [['Mont Tremblant this Saturday. Bus leaves 7:00 sharp.', 'Saturday hike', 'Bus at 7:00 · EV', '#14532d', '#65a30d']] },
  { id: 'filler-debate', handle: '@conu.debate', name: 'Concordia Debate Society', color: '#7c3aed', glyph: 'DS',
    posts: [['Open practice round tonight, no experience needed.', 'Open practice', 'Tonight · H-520', '#3b0764', '#a855f7']] },
  { id: 'filler-film', handle: '@conu.film', name: 'Film Society', color: '#b91c1c', glyph: 'FS',
    posts: [['Friday screening: bring a friend, we bring the popcorn.', 'Friday screening', '7 PM · LB-125', '#450a0a', '#ef4444']] },
  { id: 'filler-robotics', handle: '@conu.robotics', name: 'Space Concordia', color: '#1d4ed8', glyph: 'SC',
    posts: [['Rover team recruiting for the spring build.', 'Now recruiting', 'Rover team · spring', '#172554', '#3b82f6']] },
]

/** Posts by other (made-up) clubs, to sit above and below yours in Preview. */
export function demoFillerPosts(): FeedPost[] {
  return FILLER.flatMap((c, i) =>
    c.posts.map(([caption, title, sub, a, b], j) =>
      post(c, `filler-${c.id}-${j}`, caption, [demoPoster(title, sub, a, b, 1080, i % 2 ? 1080 : 1350)], 3 + i * 7, 40 + i * 23),
    ),
  )
}

/* ── Overview series ──────────────────────────────────────────────────────── */

export interface DaySeries {
  day: string
  followers: number
  newFollowers: number
  posts: number
  likes: number
  comments: number
  events: number
}

export function demoSeries(days: number): DaySeries[] {
  const out: DaySeries[] = []
  let followers = 420
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000)
    const wave = Math.sin((days - i) / 3) * 3
    const nf = Math.max(0, Math.round(4 + wave + ((days - i) % 7 === 0 ? 14 : 0)))
    followers += nf
    const p = (days - i) % 4 === 0 ? 1 : 0
    out.push({
      day: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      followers, newFollowers: nf, posts: p, likes: Math.round(18 + wave * 4 + p * 60), comments: Math.round(3 + p * 9), events: (days - i) % 9 === 0 ? 1 : 0,
    })
  }
  return out
}

/* ── The club inbox ───────────────────────────────────────────────────────── */

interface DemoConvo {
  thread: Omit<OrgThread, 'lastBody' | 'lastFromOrg' | 'lastAt' | 'unread'>
  messages: OrgMessage[]
}

const inbox = new Map<string, DemoConvo[]>()

function demoInbox(orgId: string): DemoConvo[] {
  if (!inbox.has(orgId)) {
    const m = (id: string, body: string, fromOrg: boolean, h: number, read = true): OrgMessage => ({
      id, body, fromOrg, senderName: fromOrg ? 'Marc Tremblay' : null, createdAt: hoursAgo(h), readAt: read ? hoursAgo(h) : null,
    })
    inbox.set(orgId, [
      {
        thread: { other: 'demo-student-1', handle: '@lea.m', name: 'Léa Moreau', avatar: null },
        messages: [
          m('dm-1', 'Hi! Is ConUHacks open to first-years?', false, 30),
          m('dm-2', 'It is, no experience needed. Sign-ups are on our profile.', true, 29),
          m('dm-3', 'Amazing, thank you. Can I come without a team?', false, 1, false),
        ],
      },
      {
        thread: { other: 'demo-student-2', handle: '@sam.k', name: 'Samir Khan', avatar: null },
        messages: [
          m('dm-4', 'Do you still need volunteers for Saturday?', false, 50),
          m('dm-5', "We do! I'll send the form tonight.", true, 48),
        ],
      },
    ])
  }
  return inbox.get(orgId)!
}

export function demoOrgThreads(orgId: string): OrgThread[] {
  return demoInbox(orgId)
    .map(({ thread, messages }) => {
      const last = messages[messages.length - 1]
      return {
        ...thread,
        lastBody: last?.body ?? null,
        lastFromOrg: !!last?.fromOrg,
        lastAt: last?.createdAt ?? null,
        unread: messages.filter((x) => !x.fromOrg && !x.readAt).length,
      }
    })
    .sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''))
}

export function demoOrgMessages(orgId: string, other: string): OrgMessage[] {
  return [...(demoInbox(orgId).find((c) => c.thread.other === other)?.messages ?? [])]
}

export function demoMarkRead(orgId: string, other: string) {
  for (const m of demoInbox(orgId).find((c) => c.thread.other === other)?.messages ?? []) m.readAt ??= hoursAgo(0)
}

export function demoReply(orgId: string, other: string, body: string) {
  const convo = demoInbox(orgId).find((c) => c.thread.other === other)
  convo?.messages.push({ id: `dm-${Date.now()}`, body, fromOrg: true, senderName: 'You', createdAt: hoursAgo(0), readAt: null })
}

export function demoDmCandidates(q: string): DmCandidate[] {
  const all: DmCandidate[] = [
    { userId: 'demo-student-3', name: 'Noah Tremblay', handle: '@noah.t', avatarUrl: null },
    { userId: 'demo-student-4', name: 'Ava Chen', handle: '@ava.c', avatarUrl: null },
  ]
  const needle = q.trim().toLowerCase()
  return needle ? all.filter((c) => c.name.toLowerCase().includes(needle) || c.handle?.includes(needle)) : all
}
