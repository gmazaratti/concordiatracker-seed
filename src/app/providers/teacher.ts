import { createContext, useContext } from 'react'
import type { Announcement } from '@/data/announcements'
import type { Blueprint } from '@/data/blueprints'
import type {
  AccessRequest,
  OutlineItem,
  RequestStatus,
  TeacherAccount,
  TeacherInvite,
} from '@/data/teacher'

/**
 * The teacher-portal store — the SINGLE swap point for the invite/approval/follow
 * model. Everything here is in-memory and resets on reload; re-implement this
 * provider against a backend and the screens are untouched. Invite-email,
 * approval, and verification are CONNECTION-PHASE (see CLAUDE.md).
 */
export interface TeacherContextValue {
  // Session (mock auth — no passwords)
  currentTeacher: TeacherAccount | null
  /** Sign in by email; returns false if no account matches. */
  signIn: (email: string) => boolean
  /** Convenience: sign in as the approved demo teacher. */
  signInDemo: () => void
  signOut: () => void

  // Admin
  teachers: TeacherAccount[]
  approveTeacher: (id: string) => void
  invites: TeacherInvite[]
  getInvite: (token: string) => TeacherInvite | undefined
  /** Create an invite (pre-fills name from the course's instructor). Returns it. */
  createInvite: (input: {
    courseId: string
    code: string
    title: string
    section: string
    teacherName: string
    recipientEmail: string
  }) => TeacherInvite
  /** Accept an invite → creates a PENDING account, consumes the token, signs in. */
  acceptInvite: (token: string) => TeacherAccount | null

  // Courses + outline (operate on the signed-in teacher)
  linkCourse: (input: { courseId: string; code: string; title: string; section: string }) => void
  createCourse: (input: { code: string; title: string; section: string }) => string
  updateOutline: (courseId: string, outline: OutlineItem[]) => void
  publishCourse: (courseId: string) => void

  // Supply pipe → the student blueprint browser
  publishedBlueprints: Blueprint[]
  /** Community blueprints the teacher has verified → removed from the student
   * community pool (they've become the teacher's verified outline). */
  absorbedBlueprintIds: string[]
  /** Verify a community blueprint: adopt its dates as the signed-in teacher's
   * PUBLISHED outline (so it becomes the teacher-verified pin, authored by them)
   * and absorb the original out of the community list. */
  verifyCommunityBlueprint: (courseId: string, blueprint: Blueprint) => void

  // Announcements → Today digest + course detail (seeded + posted, all mutable)
  teacherAnnouncements: Announcement[]
  postAnnouncement: (input: { courseId: string; title: string; body: string }) => void
  /** Edit an announcement → stamps it "Edited" (editedDaysAgo = 0). */
  editAnnouncement: (id: string, patch: { title: string; body: string }) => void
  deleteAnnouncement: (id: string) => void

  // Self-serve access requests (before any invite) — STUB/CONNECTION-PHASE
  accessRequests: AccessRequest[]
  /** Submit a request → returns it (with its assigned Case ID). */
  submitAccessRequest: (input: { name: string; email: string; message: string }) => AccessRequest
  /** Admin accept/deny. */
  setRequestStatus: (caseId: string, status: RequestStatus) => void
  getRequest: (caseId: string) => AccessRequest | undefined
}

export const TeacherContext = createContext<TeacherContextValue | null>(null)

export function useTeacher(): TeacherContextValue {
  const ctx = useContext(TeacherContext)
  if (!ctx) throw new Error('useTeacher must be used within <TeacherProvider>')
  return ctx
}
