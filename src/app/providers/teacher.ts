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
  // Session
  currentTeacher: TeacherAccount | null
  /** True when signed into a DEMO/seed account (not your own SELF account) — drives
   * the "sandbox, nothing is saved" banner. */
  isDemoSession: boolean
  /** Enter the portal as YOUR real logged-in account (a persistent, approved
   * teacher whose courses are saved to `teacher_courses`). */
  signInSelf: () => void
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

  // Announcements → Today digest + course detail (real `announcements` table)
  teacherAnnouncements: Announcement[]
  postAnnouncement: (input: { courseCode: string; title: string; body: string }) => void
  /** Edit an announcement → stamps it "Edited" (editedDaysAgo = 0). */
  editAnnouncement: (id: string, patch: { title: string; body: string }) => void
  deleteAnnouncement: (id: string) => void

  // Self-serve access requests → the real access_requests table (via RPCs).
  /** Submit a request → returns it with its assigned Case ID. */
  submitAccessRequest: (input: {
    role: 'teacher' | 'organizer'
    name: string
    email: string
    message: string
  }) => Promise<AccessRequest>
  /** Look up a request's status by Case ID (public). */
  getRequest: (caseId: string) => Promise<AccessRequest | null>

  // ── ORGANIZER role — same shell, different payload ──────────────────────
  /** The signed-in organizer (null if signed out or signed in as a teacher). */
  currentOrg: OrgAccount | null
  orgs: OrgAccount[]
  /** Manage YOUR own real org (persisted) — null if you don't own one yet. */
  myOrg: OrgAccount | null
  /** Create your own organization (persisted to `organizations`, owned by you).
   * Returns the new id, or '' if it failed (e.g. the handle is taken). */
  createOrg: (input: {
    name: string
    handle: string
    glyph: string
    color: string
    bio?: string
  }) => Promise<string>
  /** Enter the portal managing your own org. */
  signInSelfOrg: () => void
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
  acceptOrgInvite: (token: string) => Promise<OrgAccount | null>

  // Event management (operate on the signed-in organizer's OWN events)
  createEvent: () => string
  updateEvent: (id: string, patch: Partial<ManagedEvent>) => void
  deleteEvent: (id: string) => void
  updateOrgProfile: (patch: Partial<EventOrg>) => void
  /** Push a notification to followers ONCE (STUB — real delivery is connection-
   * phase). Marks the event notified + returns the follower count. */
  notifyFollowers: (eventId: string) => number
  /** Whether this event has already been notified (persists across re-entering). */
  isEventNotified: (eventId: string) => boolean
  /** Undo a notification so it can be fired again. */
  revertNotify: (eventId: string) => void

  // Team — who can manage the signed-in org's dashboard. Your real org persists
  // members to org_members; demo/seed orgs keep them in memory.
  /** Invite a teammate → adds a PENDING member with a single-use link; returns it. */
  inviteOrgMember: (input: { name: string; email: string; role: OrgRole }) => OrgMember
  /** Accept a teammate invite link → activates the member; resolves true on success. */
  acceptOrgMemberInvite: (token: string) => Promise<boolean>
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
