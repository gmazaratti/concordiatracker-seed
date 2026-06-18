import { createContext, useContext } from 'react'
import type { Announcement } from '@/data/announcements'
import type { Blueprint } from '@/data/blueprints'
import type { CampusEvent, EventOrg } from '@/data/community'
import type {
  AccessRequest,
  ManagedEvent,
  OrgAccount,
  OrgInvite,
  OrgMember,
  OrgRole,
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
  submitAccessRequest: (input: {
    role: 'teacher' | 'organizer'
    name: string
    email: string
    message: string
  }) => AccessRequest
  /** Admin accept/deny. */
  setRequestStatus: (caseId: string, status: RequestStatus) => void
  getRequest: (caseId: string) => AccessRequest | undefined

  // ── ORGANIZER role — same shell, different payload ──────────────────────
  /** The signed-in organizer (null if signed out or signed in as a teacher). */
  currentOrg: OrgAccount | null
  orgs: OrgAccount[]
  signInDemoOrg: () => void
  approveOrg: (id: string) => void
  orgInvites: OrgInvite[]
  getOrgInvite: (token: string) => OrgInvite | undefined
  createOrgInvite: (input: {
    orgName: string
    orgHandle: string
    glyph: string
    color: string
    recipientEmail: string
  }) => OrgInvite
  acceptOrgInvite: (token: string) => OrgAccount | null

  // Event management (operate on the signed-in organizer's OWN events)
  createEvent: () => string
  updateEvent: (id: string, patch: Partial<ManagedEvent>) => void
  deleteEvent: (id: string) => void
  updateOrgProfile: (patch: Partial<EventOrg>) => void
  /** Push a notification to followers (STUB — real delivery is connection-phase). */
  notifyFollowers: (eventId: string) => number

  // Team — who can manage the signed-in org's dashboard (invite-based, STUB)
  /** Invite a teammate → adds a PENDING member with a single-use link; returns it. */
  inviteOrgMember: (input: { name: string; email: string; role: OrgRole }) => OrgMember
  /** Accept a teammate invite link → activates the member + signs into that org. */
  acceptOrgMemberInvite: (token: string) => OrgAccount | null
  /** Remove a teammate (or revoke a pending invite). Owners can't be removed. */
  removeOrgMember: (id: string) => void

  // Supply pipe → the student Community (approved orgs only)
  communityOrgs: EventOrg[]
  communityEvents: CampusEvent[]
}

export const TeacherContext = createContext<TeacherContextValue | null>(null)

export function useTeacher(): TeacherContextValue {
  const ctx = useContext(TeacherContext)
  if (!ctx) throw new Error('useTeacher must be used within <TeacherProvider>')
  return ctx
}
