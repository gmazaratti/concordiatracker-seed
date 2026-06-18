import { useCallback, useMemo, useRef, useState } from 'react'
import { ANNOUNCEMENTS, type Announcement } from '@/data/announcements'
import type { Blueprint } from '@/data/blueprints'
import { CAMPUS_EVENTS, ORGS, type CampusEvent, type EventOrg } from '@/data/community'
import {
  FIRST_CASE_NUMBER,
  SEED_INVITES,
  SEED_ORG_INVITES,
  SEED_ORGS,
  SEED_REQUESTS,
  SEED_TEACHERS,
  caseIdFor,
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
  const [announcements, setAnnouncements] = useState<Announcement[]>(() =>
    ANNOUNCEMENTS.map((a) => ({ ...a })),
  )
  const [absorbedBlueprintIds, setAbsorbed] = useState<string[]>([])
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>(() =>
    SEED_REQUESTS.map((r) => ({ ...r })),
  )
  const caseSeq = useRef(FIRST_CASE_NUMBER)

  const currentTeacher = useMemo(
    () => teachers.find((t) => t.id === sessionId) ?? null,
    [teachers, sessionId],
  )
  const currentOrg = useMemo(() => orgs.find((o) => o.id === sessionId) ?? null, [orgs, sessionId])

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
  const signInDemo = useCallback(() => setSessionId('t-hanna'), [])
  const signInDemoOrg = useCallback(() => setSessionId('org-hack'), [])
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
  const updateCurrentCourses = useCallback(
    (fn: (courses: TeacherCourse[]) => TeacherCourse[]) => {
      setTeachers((prev) =>
        prev.map((t) => (t.id === sessionId ? { ...t, courses: fn(t.courses) } : t)),
      )
    },
    [sessionId],
  )

  const linkCourse = useCallback(
    (input: { courseId: string; code: string; title: string; section: string }) => {
      updateCurrentCourses((courses) =>
        courses.some((c) => c.courseId === input.courseId)
          ? courses
          : [...courses, { ...input, outline: [], published: false }],
      )
    },
    [updateCurrentCourses],
  )

  const createCourse = useCallback(
    (input: { code: string; title: string; section: string }) => {
      const courseId = uid('tc')
      updateCurrentCourses((courses) => [
        ...courses,
        { courseId, ...input, outline: [], published: false },
      ])
      return courseId
    },
    [updateCurrentCourses],
  )

  const updateOutline = useCallback(
    (courseId: string, outline: OutlineItem[]) => {
      updateCurrentCourses((courses) =>
        courses.map((c) => (c.courseId === courseId ? { ...c, outline } : c)),
      )
    },
    [updateCurrentCourses],
  )

  const publishCourse = useCallback(
    (courseId: string) => {
      updateCurrentCourses((courses) =>
        courses.map((c) => (c.courseId === courseId ? { ...c, published: true } : c)),
      )
    },
    [updateCurrentCourses],
  )

  // Verify a community blueprint → adopt its dates as the teacher's published
  // outline (it becomes the verified pin, authored by them) and absorb the
  // original so it leaves the student community list.
  const verifyCommunityBlueprint = useCallback(
    (courseId: string, blueprint: Blueprint) => {
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
    },
    [updateCurrentCourses],
  )

  // ── Announcements ─────────────────────────────────────────────────────────
  const postAnnouncement = useCallback(
    (input: { courseId: string; title: string; body: string }) => {
      const an: Announcement = { id: uid('an'), postedDaysAgo: 0, ...input }
      setAnnouncements((prev) => [an, ...prev])
    },
    [],
  )
  const editAnnouncement = useCallback((id: string, patch: { title: string; body: string }) => {
    setAnnouncements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch, editedDaysAgo: 0 } : a)),
    )
  }, [])
  const deleteAnnouncement = useCallback((id: string) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id))
  }, [])

  // ── Access requests ───────────────────────────────────────────────────────
  const submitAccessRequest = useCallback(
    (input: { role: 'teacher' | 'organizer'; name: string; email: string; message: string }) => {
      const req: AccessRequest = {
        caseId: caseIdFor(caseSeq.current),
        ...input,
        status: 'pending',
        requestedDaysAgo: 0,
      }
      caseSeq.current += 1
      setAccessRequests((prev) => [req, ...prev])
      return req
    },
    [],
  )
  const setRequestStatus = useCallback((caseId: string, status: RequestStatus) => {
    setAccessRequests((prev) => prev.map((r) => (r.caseId === caseId ? { ...r, status } : r)))
  }, [])

  // ── Organizer: admin (invite/approve orgs) ────────────────────────────────
  const approveOrg = useCallback((id: string) => {
    setOrgs((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, status: 'approved', org: { ...o.org, verified: true } } : o,
      ),
    )
  }, [])

  const createOrgInvite = useCallback(
    (input: {
      orgName: string
      orgHandle: string
      glyph: string
      color: string
      recipientEmail: string
    }) => {
      const invite: OrgInvite = {
        token: uid('inv'),
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
      const invite = orgInvites.find((i) => i.token === token)
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
  const updateCurrentOrg = useCallback(
    (fn: (o: OrgAccount) => OrgAccount) => {
      setOrgs((prev) => prev.map((o) => (o.id === sessionId ? fn(o) : o)))
    },
    [sessionId],
  )

  const createEvent = useCallback(() => {
    const ev = newManagedEvent()
    updateCurrentOrg((o) => ({ ...o, events: [ev, ...o.events] }))
    return ev.id
  }, [updateCurrentOrg])

  const updateEvent = useCallback(
    (id: string, patch: Partial<ManagedEvent>) => {
      updateCurrentOrg((o) => ({
        ...o,
        events: o.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      }))
    },
    [updateCurrentOrg],
  )

  const deleteEvent = useCallback(
    (id: string) => {
      updateCurrentOrg((o) => ({ ...o, events: o.events.filter((e) => e.id !== id) }))
    },
    [updateCurrentOrg],
  )

  const updateOrgProfile = useCallback(
    (patch: Partial<EventOrg>) => {
      updateCurrentOrg((o) => ({ ...o, org: { ...o.org, ...patch } }))
    },
    [updateCurrentOrg],
  )

  // Notify followers — STUB. Real delivery is connection-phase; returns the
  // (mock) follower count for the confirmation toast.
  const notifyFollowers = useCallback(
    () => orgs.find((o) => o.id === sessionId)?.followers ?? 0,
    [orgs, sessionId],
  )

  // ── Organizer: team (who can manage the dashboard) — invite-based STUB ─────
  const inviteOrgMember = useCallback(
    (input: { name: string; email: string; role: OrgRole }) => {
      const member = newOrgMemberInvite(input)
      updateCurrentOrg((o) => ({ ...o, members: [...o.members, member] }))
      return member
    },
    [updateCurrentOrg],
  )

  const acceptOrgMemberInvite = useCallback(
    (token: string) => {
      const org = orgs.find((o) => o.members.some((m) => m.inviteToken === token))
      if (!org) return null
      setOrgs((prev) =>
        prev.map((o) =>
          o.id === org.id
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
      setSessionId(org.id)
      return org
    },
    [orgs],
  )

  const removeOrgMember = useCallback(
    (id: string) => {
      updateCurrentOrg((o) => ({
        ...o,
        members: o.members.filter((m) => m.id !== id || m.role === 'owner'),
      }))
    },
    [updateCurrentOrg],
  )

  const value = useMemo<TeacherContextValue>(
    () => ({
      currentTeacher,
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
      accessRequests,
      submitAccessRequest,
      setRequestStatus,
      getRequest: (caseId: string) => accessRequests.find((r) => r.caseId === caseId),
      // organizer
      currentOrg,
      orgs,
      signInDemoOrg,
      approveOrg,
      orgInvites,
      getOrgInvite: (token: string) => orgInvites.find((i) => i.token === token),
      createOrgInvite,
      acceptOrgInvite,
      createEvent,
      updateEvent,
      deleteEvent,
      updateOrgProfile,
      notifyFollowers,
      inviteOrgMember,
      acceptOrgMemberInvite,
      removeOrgMember,
      communityOrgs,
      communityEvents,
    }),
    [
      currentTeacher,
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
      accessRequests,
      submitAccessRequest,
      setRequestStatus,
      currentOrg,
      orgs,
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
      inviteOrgMember,
      acceptOrgMemberInvite,
      removeOrgMember,
      communityOrgs,
      communityEvents,
    ],
  )

  return <TeacherContext value={value}>{children}</TeacherContext>
}
