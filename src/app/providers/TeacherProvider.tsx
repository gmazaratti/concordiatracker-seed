import { useCallback, useMemo, useRef, useState } from 'react'
import { ANNOUNCEMENTS, type Announcement } from '@/data/announcements'
import type { Blueprint } from '@/data/blueprints'
import {
  FIRST_CASE_NUMBER,
  SEED_INVITES,
  SEED_REQUESTS,
  SEED_TEACHERS,
  caseIdFor,
  inviteStatus,
  outlineToBlueprint,
  uid,
  type AccessRequest,
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

  const publishedBlueprints = useMemo(
    () =>
      teachers.flatMap((t) =>
        t.courses.filter((c) => c.published).map((c) => outlineToBlueprint(c, t.name)),
      ),
    [teachers],
  )

  // ── Session ──────────────────────────────────────────────────────────────
  const signIn = useCallback(
    (email: string) => {
      const match = teachers.find((t) => t.email.toLowerCase() === email.trim().toLowerCase())
      if (!match) return false
      setSessionId(match.id)
      return true
    },
    [teachers],
  )
  const signInDemo = useCallback(() => setSessionId('t-hanna'), [])
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
    (input: { name: string; email: string; message: string }) => {
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
    ],
  )

  return <TeacherContext value={value}>{children}</TeacherContext>
}
