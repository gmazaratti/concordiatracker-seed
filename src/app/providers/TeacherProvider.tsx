import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Announcement } from '@/data/announcements'
import type { Blueprint } from '@/data/blueprints'
import { CAMPUS_EVENTS, ORGS, type CampusEvent, type EventOrg } from '@/data/community'
import { term } from '@/data/mock'
import { supabase, fireWrite } from '@/lib/supabase'
import {
  announcementFromRow,
  eventRowToManaged,
  managedEventToRow,
  normalizeCode,
  orgFromRow,
  orgMemberFromRow,
  orgProfileToRow,
  type AnnouncementRow,
  type EventRow,
  type OrgMemberRow,
  type OrgRow,
} from '@/lib/supabase-adapters'
import { useAuth } from './auth'
import { useAppData } from './app-data'
import { useCommunityData } from './community-data'

/** Session sentinel: signed in as your OWN real account (not a seed/demo teacher). */
const SELF = 'self'
/** Session sentinel: managing your OWN real organization. */
const SELF_ORG = 'self-org'

const ORG_COLS = 'id, owner_id, handle, name, verified, glyph, color, logo, banner, bio, links, status'
const EVENT_COLS =
  'id, org_id, title, start, mode, location, category, description, image, relevant_to, posted_at'

/** A `teacher_courses` row (the teacher's persisted managed course + draft outline). */
interface TeacherCourseRow {
  id: string
  code: string | null
  title: string | null
  section: string | null
  outline: OutlineItem[] | null
  published: boolean | null
  blueprint_id: string | null
}
import {
  SEED_INVITES,
  SEED_ORG_INVITES,
  SEED_ORGS,
  SEED_TEACHERS,
  decodeOrgInvite,
  encodeOrgInvite,
  eventToCommunity,
  inviteStatus,
  newManagedEvent,
  newOrgMemberInvite,
  orgFromInvite,
  outlineToBlueprint,
  uid,
  type AccessRequest,
  type ManagedEvent,
  type OrgAccount,
  type OrgInvite,
  type OrgMember,
  type OrgRole,
  type OutlineItem,
  type RequestStatus,
  type TeacherAccount,
  type TeacherCourse,
  type TeacherInvite,
} from '@/data/teacher'
import { TeacherContext, type TeacherContextValue } from './teacher'

/** In-memory teacher store. Resets on reload (like the rest of the seed). The
 * SINGLE place to swap for a backend — every screen reads through `useTeacher`. */
export function TeacherProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser } = useAuth()
  const { user } = useAppData()
  const { refresh: refreshCommunity } = useCommunityData()
  // teacher courseId → the shared_blueprints row published from it (so re-publishing
  // UPDATES the same blueprint instead of inserting a duplicate). Resets on reload.
  const publishedBlueprintIds = useRef<Map<string, string>>(new Map())
  // The logged-in user's OWN persisted teacher courses (loaded from teacher_courses).
  const [myCourses, setMyCourses] = useState<TeacherCourse[]>([])
  // The logged-in user's OWN organization (loaded from organizations + events).
  const [myOrg, setMyOrg] = useState<OrgAccount | null>(null)
  // Which events have had "Notify followers" fired — once-only unless reverted.
  // SWAPPABLE STUB: in-memory (resets on reload); real once-only enforcement is a
  // backend concern, but the UX (persists across re-entering the event) is real.
  const [notifiedEventIds, setNotifiedEventIds] = useState<Set<string>>(() => new Set())
  const [teachers, setTeachers] = useState<TeacherAccount[]>(() =>
    SEED_TEACHERS.map((t) => ({ ...t, courses: t.courses.map((c) => ({ ...c })) })),
  )
  const [invites, setInvites] = useState<TeacherInvite[]>(() => SEED_INVITES.map((i) => ({ ...i })))
  const [orgs, setOrgs] = useState<OrgAccount[]>(() =>
    SEED_ORGS.map((o) => ({
      ...o,
      org: { ...o.org },
      events: o.events.map((e) => ({ ...e })),
      members: o.members.map((m) => ({ ...m })),
    })),
  )
  const [orgInvites, setOrgInvites] = useState<OrgInvite[]>(() =>
    SEED_ORG_INVITES.map((i) => ({ ...i })),
  )
  const [sessionId, setSessionId] = useState<string | null>(null)
  // Announcements are loaded from the `announcements` table (Phase 9).
  const [announcements, setAnnouncements] = useState<Announcement[]>([])

  useEffect(() => {
    let active = true
    void (async () => {
      const { data } = await supabase
        .from('announcements')
        .select('id, course_code, title, body, posted_at, edited_at')
        .order('posted_at', { ascending: false })
      if (!active) return
      setAnnouncements((data as AnnouncementRow[] | null)?.map(announcementFromRow) ?? [])
    })()
    return () => {
      active = false
    }
  }, [])

  // Load the logged-in user's own teacher courses (+ restore published blueprint ids).
  useEffect(() => {
    let active = true
    void (async () => {
      if (!authUser) {
        if (active) setMyCourses([])
        return
      }
      const { data } = await supabase
        .from('teacher_courses')
        .select('id, code, title, section, outline, published, blueprint_id')
        .eq('user_id', authUser.id)
        .order('created_at')
      if (!active) return
      const rows = (data as TeacherCourseRow[] | null) ?? []
      for (const r of rows) if (r.blueprint_id) publishedBlueprintIds.current.set(r.id, r.blueprint_id)
      setMyCourses(
        rows.map((r) => ({
          courseId: r.id,
          code: r.code ?? '',
          title: r.title ?? '',
          section: r.section ?? '',
          outline: r.outline ?? [],
          published: !!r.published,
        })),
      )
    })()
    return () => {
      active = false
    }
  }, [authUser])

  // Load the logged-in user's own organization (if they own one) + its events.
  useEffect(() => {
    let active = true
    void (async () => {
      if (!authUser) {
        if (active) setMyOrg(null)
        return
      }
      const { data: orgRows } = await supabase
        .from('organizations')
        .select(ORG_COLS)
        .eq('owner_id', authUser.id)
        .limit(1)
      if (!active) return
      const orgRow = (orgRows as (OrgRow & { status: string })[] | null)?.[0]
      if (!orgRow) {
        setMyOrg(null)
        return
      }
      const { data: evRows } = await supabase
        .from('events')
        .select(EVENT_COLS)
        .eq('org_id', orgRow.id)
        .order('start')
      const { data: memberRows } = await supabase
        .from('org_members')
        .select('id,name,email,role,status,invite_token,joined_at')
        .eq('org_id', orgRow.id)
        .order('created_at')
      if (!active) return
      setMyOrg({
        id: orgRow.id,
        email: authUser.email ?? '',
        status: orgRow.status === 'approved' ? 'approved' : 'pending',
        org: orgFromRow(orgRow),
        events: (evRows as EventRow[] | null)?.map(eventRowToManaged) ?? [],
        followers: 0,
        members: (memberRows as OrgMemberRow[] | null)?.map(orgMemberFromRow) ?? [],
      })
    })()
    return () => {
      active = false
    }
  }, [authUser])

  const [absorbedBlueprintIds, setAbsorbed] = useState<string[]>([])

  const currentTeacher = useMemo<TeacherAccount | null>(() => {
    if (sessionId === SELF && authUser) {
      return {
        id: SELF,
        name: user.name,
        email: authUser.email ?? user.email,
        status: 'approved',
        courses: myCourses,
      }
    }
    return teachers.find((t) => t.id === sessionId) ?? null
  }, [sessionId, authUser, user.name, user.email, myCourses, teachers])
  const currentOrg = useMemo<OrgAccount | null>(() => {
    if (sessionId === SELF_ORG) {
      if (!myOrg) return null
      // Pin the current user (the owner) at the top of the team, badged "You".
      const owner: OrgMember = {
        id: 'owner-self',
        name: user.name,
        email: authUser?.email ?? user.email,
        role: 'owner',
        status: 'active',
        joinedDaysAgo: 0,
        isYou: true,
      }
      return { ...myOrg, members: [owner, ...myOrg.members.filter((m) => m.id !== 'owner-self')] }
    }
    return orgs.find((o) => o.id === sessionId) ?? null
  }, [sessionId, myOrg, orgs, user.name, user.email, authUser])

  // A demo/seed session (not your own persistent SELF account) — used to show the
  // "you're in a sandbox, nothing is saved" banner. Demo writes nothing real.
  const isDemoSession = sessionId != null && sessionId !== SELF && sessionId !== SELF_ORG

  // Supply pipe → the student Community: approved orgs source from the provider
  // (so edits/creates flow live); their static counterparts are shadowed.
  const communityOrgs = useMemo<EventOrg[]>(() => {
    const approved = orgs.filter((o) => o.status === 'approved')
    const handles = new Set(approved.map((o) => o.org.handle))
    return [...ORGS.filter((o) => !handles.has(o.handle)), ...approved.map((o) => o.org)]
  }, [orgs])

  const communityEvents = useMemo<CampusEvent[]>(() => {
    const approved = orgs.filter((o) => o.status === 'approved')
    const handles = new Set(approved.map((o) => o.org.handle))
    return [
      ...CAMPUS_EVENTS.filter((e) => !handles.has(e.org.handle)),
      ...approved.flatMap((o) => o.events.map((e) => eventToCommunity(e, o.org))),
    ]
  }, [orgs])

  const publishedBlueprints = useMemo(
    () =>
      teachers.flatMap((t) =>
        t.courses.filter((c) => c.published).map((c) => outlineToBlueprint(c, t.name)),
      ),
    [teachers],
  )

  // ── Session (a teacher OR an organizer account) ───────────────────────────
  const signIn = useCallback(
    (email: string) => {
      const e = email.trim().toLowerCase()
      const t = teachers.find((x) => x.email.toLowerCase() === e)
      if (t) {
        setSessionId(t.id)
        return true
      }
      const o = orgs.find((x) => x.email.toLowerCase() === e)
      if (o) {
        setSessionId(o.id)
        return true
      }
      return false
    },
    [teachers, orgs],
  )
  // Enter as YOUR real account — a persistent, approved teacher (records a
  // teacher_accounts row owned by you; your courses load from teacher_courses).
  const signInSelf = useCallback(() => {
    if (!authUser) return
    setSessionId(SELF)
    fireWrite(
      supabase.from('teacher_accounts').upsert(
        { user_id: authUser.id, name: user.name, email: authUser.email ?? '', status: 'approved' },
        { onConflict: 'user_id' },
      ),
    )
  }, [authUser, user.name])
  const signInDemo = useCallback(() => setSessionId('t-hanna'), [])
  const signInDemoOrg = useCallback(() => setSessionId('org-hack'), [])

  // Create your OWN organization (persisted, owned by you). Starts PENDING — like
  // the teacher portal, an org needs admin approval before its events reach the
  // Community feed (the RLS won't surface a pending org's events). Returns its id,
  // or '' if it failed (e.g. the handle is taken — `organizations.handle` is unique).
  const createOrg = useCallback(
    async (input: { name: string; handle: string; glyph: string; color: string; bio?: string }) => {
      if (!authUser) return ''
      const handle = input.handle.startsWith('@') ? input.handle : `@${input.handle}`
      const { data, error } = await supabase
        .from('organizations')
        .insert({
          owner_id: authUser.id,
          handle,
          name: input.name,
          verified: false,
          glyph: input.glyph,
          color: input.color,
          bio: input.bio ?? '',
          status: 'pending',
        })
        .select(ORG_COLS)
        .maybeSingle()
      if (error || !data) return ''
      const row = data as OrgRow & { status: string }
      setMyOrg({
        id: row.id,
        email: authUser.email ?? '',
        status: 'pending',
        org: orgFromRow(row),
        events: [],
        followers: 0,
        members: [],
      })
      setSessionId(SELF_ORG)
      return row.id
    },
    [authUser],
  )
  const signInSelfOrg = useCallback(() => {
    if (myOrg) setSessionId(SELF_ORG)
  }, [myOrg])
  const signOut = useCallback(() => setSessionId(null), [])

  // ── Admin ────────────────────────────────────────────────────────────────
  const approveTeacher = useCallback((id: string) => {
    setTeachers((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'approved' } : t)))
  }, [])

  const createInvite = useCallback(
    (input: {
      courseId: string
      code: string
      title: string
      section: string
      teacherName: string
      recipientEmail: string
    }) => {
      const invite: TeacherInvite = {
        token: uid('inv'),
        recipientEmail: input.recipientEmail,
        teacherName: input.teacherName,
        courseId: input.courseId,
        code: input.code,
        title: input.title,
        section: input.section,
        createdDaysAgo: 0,
        expiresInDays: 7,
        used: false,
      }
      setInvites((prev) => [invite, ...prev])
      return invite
    },
    [],
  )

  const acceptInvite = useCallback(
    (token: string) => {
      const invite = invites.find((i) => i.token === token)
      if (inviteStatus(invite) !== 'valid' || !invite) return null
      const account: TeacherAccount = {
        id: uid('t'),
        name: invite.teacherName,
        email: invite.recipientEmail,
        status: 'pending',
        courses: [
          {
            courseId: invite.courseId,
            code: invite.code,
            title: invite.title,
            section: invite.section,
            outline: [],
            published: false,
          },
        ],
      }
      setTeachers((prev) => [...prev, account])
      setInvites((prev) => prev.map((i) => (i.token === token ? { ...i, used: true } : i)))
      setSessionId(account.id)
      return account
    },
    [invites],
  )

  // ── Courses + outline (operate on the signed-in teacher) ─────────────────
  // For your own account (SELF) these mutate `myCourses` + persist to the
  // `teacher_courses` table; for a seed/demo teacher they're in-memory only.
  const updateCurrentCourses = useCallback(
    (fn: (courses: TeacherCourse[]) => TeacherCourse[]) => {
      if (sessionId === SELF) setMyCourses((prev) => fn(prev))
      else setTeachers((prev) => prev.map((t) => (t.id === sessionId ? { ...t, courses: fn(t.courses) } : t)))
    },
    [sessionId],
  )

  // Insert a course into the SELF account (persisted). Returns its new id.
  const addSelfCourse = useCallback(
    (input: { code: string; title: string; section: string }) => {
      const id = crypto.randomUUID()
      setMyCourses((prev) => [
        ...prev,
        { courseId: id, code: input.code, title: input.title, section: input.section, outline: [], published: false },
      ])
      if (authUser)
        fireWrite(
          supabase.from('teacher_courses').insert({
            id,
            user_id: authUser.id,
            code: input.code,
            title: input.title,
            section: input.section,
          }),
        )
      return id
    },
    [authUser],
  )

  const linkCourse = useCallback(
    (input: { courseId: string; code: string; title: string; section: string }) => {
      if (sessionId === SELF) {
        if (myCourses.some((c) => c.code === input.code && c.section === input.section)) return
        addSelfCourse(input)
        return
      }
      updateCurrentCourses((courses) =>
        courses.some((c) => c.courseId === input.courseId)
          ? courses
          : [...courses, { ...input, outline: [], published: false }],
      )
    },
    [sessionId, myCourses, addSelfCourse, updateCurrentCourses],
  )

  const createCourse = useCallback(
    (input: { code: string; title: string; section: string }) => {
      if (sessionId === SELF) return addSelfCourse(input)
      const courseId = uid('tc')
      updateCurrentCourses((courses) => [
        ...courses,
        { courseId, ...input, outline: [], published: false },
      ])
      return courseId
    },
    [sessionId, addSelfCourse, updateCurrentCourses],
  )

  const updateOutline = useCallback(
    (courseId: string, outline: OutlineItem[]) => {
      updateCurrentCourses((courses) =>
        courses.map((c) => (c.courseId === courseId ? { ...c, outline } : c)),
      )
      if (sessionId === SELF) fireWrite(supabase.from('teacher_courses').update({ outline }).eq('id', courseId))
    },
    [sessionId, updateCurrentCourses],
  )

  // Shared writer: a teacher course's dates → a REAL teacher-verified blueprint in
  // `shared_blueprints` (Phase 5's table), so it shows pinned in the student
  // browser. First publish inserts; re-publishing UPDATES the same row.
  // ONLY your own account (SELF) publishes for real — DEMO teachers are a
  // read-only sandbox so a prospective teacher can explore without affecting data.
  const writeVerifiedBlueprint = useCallback(
    async (
      courseId: string,
      tc: TeacherCourse,
      teacherName: string,
      dates: { title: string; kind: OutlineItem['kind']; weight: number; due: string }[],
    ) => {
      if (sessionId !== SELF || !authUser) return
      const row = {
        user_id: authUser.id,
        course_code: normalizeCode(tc.code),
        course_name: tc.title,
        professor: teacherName,
        author: teacherName,
        section: tc.section,
        term: term.name,
        verified: true,
        items: dates.map((d) => ({ title: d.title, kind: d.kind, weight: d.weight, due: d.due })),
      }
      const existing = publishedBlueprintIds.current.get(courseId)
      if (existing) {
        fireWrite(supabase.from('shared_blueprints').update(row).eq('id', existing))
      } else {
        const { data } = await supabase
          .from('shared_blueprints')
          .insert(row)
          .select('id')
          .maybeSingle()
        if (data) publishedBlueprintIds.current.set(courseId, (data as { id: string }).id)
      }
    },
    [sessionId, authUser],
  )

  // Persist a SELF course's published state + which blueprint row it published.
  const persistSelfPublished = useCallback((courseId: string) => {
    if (sessionId !== SELF) return
    fireWrite(
      supabase
        .from('teacher_courses')
        .update({ published: true, blueprint_id: publishedBlueprintIds.current.get(courseId) ?? null })
        .eq('id', courseId),
    )
  }, [sessionId])

  const publishCourse = useCallback(
    async (courseId: string) => {
      const tc = currentTeacher?.courses.find((c) => c.courseId === courseId)
      const teacherName = currentTeacher?.name ?? ''
      updateCurrentCourses((courses) =>
        courses.map((c) => (c.courseId === courseId ? { ...c, published: true } : c)),
      )
      if (tc) await writeVerifiedBlueprint(courseId, tc, teacherName, tc.outline)
      persistSelfPublished(courseId)
    },
    [updateCurrentCourses, currentTeacher, writeVerifiedBlueprint, persistSelfPublished],
  )

  // Verify a community blueprint → adopt its dates as the teacher's published
  // (verified) outline, authored by them. Note: the original community upload is
  // NOT removed (you can't delete another user's row) — the verified pin simply
  // ranks above it; the old in-memory "absorb" is kept harmlessly for the UI.
  const verifyCommunityBlueprint = useCallback(
    async (courseId: string, blueprint: Blueprint) => {
      const tc = currentTeacher?.courses.find((c) => c.courseId === courseId)
      const teacherName = currentTeacher?.name ?? ''
      const outline: OutlineItem[] = blueprint.dates.map((d) => ({
        id: uid('oi'),
        kind: d.kind,
        title: d.title,
        due: d.due,
        weight: d.weight,
      }))
      updateCurrentCourses((courses) =>
        courses.map((c) => (c.courseId === courseId ? { ...c, outline, published: true } : c)),
      )
      setAbsorbed((prev) => (prev.includes(blueprint.id) ? prev : [...prev, blueprint.id]))
      if (sessionId === SELF) fireWrite(supabase.from('teacher_courses').update({ outline }).eq('id', courseId))
      if (tc) await writeVerifiedBlueprint(courseId, tc, teacherName, blueprint.dates)
      persistSelfPublished(courseId)
    },
    [sessionId, updateCurrentCourses, currentTeacher, writeVerifiedBlueprint, persistSelfPublished],
  )

  // ── Announcements (backed by the `announcements` table) ────────────────────
  // Demo teachers post/edit/delete in-memory only (ephemeral); only your own
  // account (SELF) writes to the real `announcements` table.
  const postAnnouncement = useCallback(
    async (input: { courseCode: string; title: string; body: string }) => {
      const code = normalizeCode(input.courseCode)
      if (sessionId !== SELF || !authUser) {
        setAnnouncements((prev) => [
          { id: uid('an'), courseCode: code, title: input.title, body: input.body, postedDaysAgo: 0 },
          ...prev,
        ])
        return
      }
      const { data } = await supabase
        .from('announcements')
        .insert({
          course_code: code,
          author_id: authUser.id,
          author_name: currentTeacher?.name ?? '',
          title: input.title,
          body: input.body,
        })
        .select('id, course_code, title, body, posted_at, edited_at')
        .maybeSingle()
      if (data) setAnnouncements((prev) => [announcementFromRow(data as AnnouncementRow), ...prev])
    },
    [sessionId, authUser, currentTeacher],
  )
  const editAnnouncement = useCallback(
    (id: string, patch: { title: string; body: string }) => {
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...patch, editedDaysAgo: 0 } : a)),
      )
      if (sessionId !== SELF) return
      fireWrite(
        supabase
          .from('announcements')
          .update({ title: patch.title, body: patch.body, edited_at: new Date().toISOString() })
          .eq('id', id),
      )
    },
    [sessionId],
  )
  const deleteAnnouncement = useCallback(
    (id: string) => {
      setAnnouncements((prev) => prev.filter((a) => a.id !== id))
      if (sessionId !== SELF) return
      fireWrite(supabase.from('announcements').delete().eq('id', id))
    },
    [sessionId],
  )

  // ── Access requests (real: the access_requests table, via RPCs) ───────────
  const submitAccessRequest = useCallback(
    async (input: {
      role: 'teacher' | 'organizer'
      name: string
      email: string
      message: string
    }): Promise<AccessRequest> => {
      const { data, error } = await supabase.rpc('submit_access_request', {
        p_role: input.role,
        p_name: input.name,
        p_email: input.email,
        p_message: input.message,
      })
      if (error) throw error
      return { caseId: data as string, ...input, status: 'pending', requestedDaysAgo: 0 }
    },
    [],
  )

  const getRequest = useCallback(async (caseId: string): Promise<AccessRequest | null> => {
    const { data } = await supabase.rpc('get_access_request', { p_case_id: caseId })
    const row = (Array.isArray(data) ? data[0] : data) as
      | { case_id: string; role: 'teacher' | 'organizer'; name: string; status: RequestStatus; created_at: string }
      | undefined
    if (!row) return null
    return {
      caseId: row.case_id,
      role: row.role,
      name: row.name,
      email: '',
      message: '',
      status: row.status,
      requestedDaysAgo: Math.max(0, Math.round((Date.now() - new Date(row.created_at).getTime()) / 86_400_000)),
    }
  }, [])

  // ── Organizer: admin (invite/approve orgs) ────────────────────────────────
  const approveOrg = useCallback(
    (id: string) => {
      // Your own org → persist the approval (so its events reach the feed) +
      // refresh. (Dev: the owner self-approves via the admin console; real
      // admin-only approval is a connection-phase RLS hardening.)
      if (myOrg && id === myOrg.id) {
        setMyOrg((prev) =>
          prev ? { ...prev, status: 'approved', org: { ...prev.org, verified: true } } : prev,
        )
        fireWrite(
          supabase.from('organizations').update({ status: 'approved', verified: true }).eq('id', id),
        )
        refreshCommunity()
        return
      }
      setOrgs((prev) =>
        prev.map((o) =>
          o.id === id ? { ...o, status: 'approved', org: { ...o.org, verified: true } } : o,
        ),
      )
    },
    [myOrg, refreshCommunity],
  )

  const createOrgInvite = useCallback(
    (input: {
      orgName: string
      orgHandle: string
      glyph: string
      color: string
      recipientEmail: string
    }) => {
      const invite: OrgInvite = {
        // Self-describing token → the link works on any device / fresh load with
        // no backend (the org details travel in the URL).
        token: encodeOrgInvite(input),
        recipientEmail: input.recipientEmail,
        orgName: input.orgName,
        orgHandle: input.orgHandle,
        glyph: input.glyph,
        color: input.color,
        createdDaysAgo: 0,
        expiresInDays: 7,
        used: false,
      }
      setOrgInvites((prev) => [invite, ...prev])
      return invite
    },
    [],
  )

  const acceptOrgInvite = useCallback(
    (token: string) => {
      // In-memory (created this session) OR decoded from the self-describing link.
      const invite = orgInvites.find((i) => i.token === token) ?? decodeOrgInvite(token) ?? undefined
      if (inviteStatus(invite) !== 'valid' || !invite) return null
      const account: OrgAccount = {
        id: uid('org'),
        email: invite.recipientEmail,
        status: 'pending',
        org: orgFromInvite(invite),
        events: [],
        followers: 0,
        members: [
          {
            id: uid('mem'),
            name: invite.orgName,
            email: invite.recipientEmail,
            role: 'owner',
            status: 'active',
            joinedDaysAgo: 0,
          },
        ],
      }
      setOrgs((prev) => [...prev, account])
      setOrgInvites((prev) => prev.map((i) => (i.token === token ? { ...i, used: true } : i)))
      setSessionId(account.id)
      return account
    },
    [orgInvites],
  )

  // ── Organizer: event + profile management (the signed-in org's OWN events) ─
  // For YOUR org (SELF_ORG) these persist to `organizations`/`events` and refresh
  // the Community feed; for a seed/demo org they're in-memory only.
  const updateCurrentOrg = useCallback(
    (fn: (o: OrgAccount) => OrgAccount) => {
      if (sessionId === SELF_ORG) setMyOrg((prev) => (prev ? fn(prev) : prev))
      else setOrgs((prev) => prev.map((o) => (o.id === sessionId ? fn(o) : o)))
    },
    [sessionId],
  )

  const createEvent = useCallback(() => {
    const ev = newManagedEvent()
    if (sessionId === SELF_ORG && myOrg) {
      const id = crypto.randomUUID()
      updateCurrentOrg((o) => ({ ...o, events: [{ ...ev, id }, ...o.events] }))
      // Blank draft (no title) → filtered out of the public feed until saved.
      fireWrite(supabase.from('events').insert({ id, org_id: myOrg.id, ...managedEventToRow(ev) }))
      return id
    }
    updateCurrentOrg((o) => ({ ...o, events: [ev, ...o.events] }))
    return ev.id
  }, [sessionId, myOrg, updateCurrentOrg])

  const updateEvent = useCallback(
    (id: string, patch: Partial<ManagedEvent>) => {
      updateCurrentOrg((o) => ({
        ...o,
        events: o.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      }))
      if (sessionId === SELF_ORG) {
        void (async () => {
          const { error } = await supabase.from('events').update(managedEventToRow(patch)).eq('id', id)
          if (error) console.error('event update failed:', error)
          refreshCommunity()
        })()
      }
    },
    [sessionId, updateCurrentOrg, refreshCommunity],
  )

  const deleteEvent = useCallback(
    (id: string) => {
      updateCurrentOrg((o) => ({ ...o, events: o.events.filter((e) => e.id !== id) }))
      if (sessionId === SELF_ORG) {
        void (async () => {
          await supabase.from('events').delete().eq('id', id)
          refreshCommunity()
        })()
      }
    },
    [sessionId, updateCurrentOrg, refreshCommunity],
  )

  const updateOrgProfile = useCallback(
    (patch: Partial<EventOrg>) => {
      updateCurrentOrg((o) => ({ ...o, org: { ...o.org, ...patch } }))
      if (sessionId === SELF_ORG && myOrg) {
        void (async () => {
          const { error } = await supabase
            .from('organizations')
            .update(orgProfileToRow(patch))
            .eq('id', myOrg.id)
          if (error) console.error('org profile update failed:', error)
          refreshCommunity()
        })()
      }
    },
    [sessionId, myOrg, updateCurrentOrg, refreshCommunity],
  )

  // Notify followers — STUB. Real delivery is connection-phase; returns the
  // (mock) follower count for the confirmation toast.
  // Fire the (stubbed) follower notification ONCE per event — marks it notified
  // and returns the follower count. Won't re-fire unless reverted.
  const notifyFollowers = useCallback(
    (eventId: string) => {
      setNotifiedEventIds((prev) => {
        if (prev.has(eventId)) return prev
        const next = new Set(prev)
        next.add(eventId)
        return next
      })
      const own = sessionId === SELF_ORG ? myOrg : orgs.find((o) => o.id === sessionId)
      return own?.followers ?? 0
    },
    [sessionId, myOrg, orgs],
  )
  const isEventNotified = useCallback((eventId: string) => notifiedEventIds.has(eventId), [notifiedEventIds])
  const revertNotify = useCallback((eventId: string) => {
    setNotifiedEventIds((prev) => {
      const next = new Set(prev)
      next.delete(eventId)
      return next
    })
  }, [])

  // ── Organizer: team (who can manage the dashboard) — invite-based STUB ─────
  const inviteOrgMember = useCallback(
    (input: { name: string; email: string; role: OrgRole }) => {
      const member = newOrgMemberInvite(input)
      // For your REAL org, the member is a DB row (uuid id) — the same record the
      // admin console + Team list read back from org_members.
      if (sessionId === SELF_ORG && myOrg) {
        member.id = crypto.randomUUID()
        fireWrite(
          supabase.from('org_members').insert({
            id: member.id,
            org_id: myOrg.id,
            name: member.name,
            email: member.email,
            role: member.role,
            status: 'invited',
            invite_token: member.inviteToken,
          }),
        )
      }
      updateCurrentOrg((o) => ({ ...o, members: [...o.members, member] }))
      return member
    },
    [updateCurrentOrg, sessionId, myOrg],
  )

  const acceptOrgMemberInvite = useCallback(
    async (token: string): Promise<boolean> => {
      // Demo/seed orgs hold their members in memory.
      const demo = orgs.find((o) => o.members.some((m) => m.inviteToken === token))
      if (demo) {
        setOrgs((prev) =>
          prev.map((o) =>
            o.id === demo.id
              ? {
                  ...o,
                  members: o.members.map((m) =>
                    m.inviteToken === token
                      ? { ...m, status: 'active', joinedDaysAgo: 0, inviteToken: undefined }
                      : m,
                  ),
                }
              : o,
          ),
        )
        setSessionId(demo.id)
        return true
      }
      // A real invite lives in org_members → activate via the definer RPC (the
      // invitee isn't the owner, so RLS can't let them UPDATE directly).
      const { data: orgId } = await supabase.rpc('accept_org_member_invite', { p_token: token })
      if (!orgId) return false
      if (myOrg && myOrg.id === orgId) setSessionId(SELF_ORG)
      return true
    },
    [orgs, myOrg],
  )

  const removeOrgMember = useCallback(
    (id: string) => {
      if (sessionId === SELF_ORG && myOrg) {
        fireWrite(supabase.from('org_members').delete().eq('id', id))
      }
      updateCurrentOrg((o) => ({
        ...o,
        members: o.members.filter((m) => m.id !== id || m.role === 'owner'),
      }))
    },
    [updateCurrentOrg, sessionId, myOrg],
  )

  const value = useMemo<TeacherContextValue>(
    () => ({
      currentTeacher,
      isDemoSession,
      signInSelf,
      signIn,
      signInDemo,
      signOut,
      teachers,
      approveTeacher,
      invites,
      getInvite: (token: string) => invites.find((i) => i.token === token),
      createInvite,
      acceptInvite,
      linkCourse,
      createCourse,
      updateOutline,
      publishCourse,
      publishedBlueprints,
      absorbedBlueprintIds,
      verifyCommunityBlueprint,
      teacherAnnouncements: announcements,
      postAnnouncement,
      editAnnouncement,
      deleteAnnouncement,
      submitAccessRequest,
      getRequest,
      // organizer
      currentOrg,
      orgs,
      myOrg,
      createOrg,
      signInSelfOrg,
      signInDemoOrg,
      approveOrg,
      orgInvites,
      getOrgInvite: (token: string) =>
        orgInvites.find((i) => i.token === token) ?? decodeOrgInvite(token) ?? undefined,
      createOrgInvite,
      acceptOrgInvite,
      createEvent,
      updateEvent,
      deleteEvent,
      updateOrgProfile,
      notifyFollowers,
      isEventNotified,
      revertNotify,
      inviteOrgMember,
      acceptOrgMemberInvite,
      removeOrgMember,
      communityOrgs,
      communityEvents,
    }),
    [
      currentTeacher,
      isDemoSession,
      signInSelf,
      signIn,
      signInDemo,
      signOut,
      teachers,
      approveTeacher,
      invites,
      createInvite,
      acceptInvite,
      linkCourse,
      createCourse,
      updateOutline,
      publishCourse,
      publishedBlueprints,
      absorbedBlueprintIds,
      verifyCommunityBlueprint,
      announcements,
      postAnnouncement,
      editAnnouncement,
      deleteAnnouncement,
      submitAccessRequest,
      getRequest,
      currentOrg,
      orgs,
      myOrg,
      createOrg,
      signInSelfOrg,
      signInDemoOrg,
      approveOrg,
      orgInvites,
      createOrgInvite,
      acceptOrgInvite,
      createEvent,
      updateEvent,
      deleteEvent,
      updateOrgProfile,
      notifyFollowers,
      isEventNotified,
      revertNotify,
      inviteOrgMember,
      acceptOrgMemberInvite,
      removeOrgMember,
      communityOrgs,
      communityEvents,
    ],
  )

  return <TeacherContext value={value}>{children}</TeacherContext>
}
