import { useCallback, useState } from 'react'
import { BadgeCheck, CalendarDays, ChevronDown, FileText, Megaphone, Users } from 'lucide-react'
import {
  adminDeleteOrg,
  adminListOrgMembers,
  adminListPortalOrgs,
  adminListPortalTeachers,
  adminRemoveOrgMember,
  adminRemoveTeacher,
  adminSetTeacherStatus,
  adminSetOrgStatus,
  useAdminList,
  type OrgMember,
  type PortalOrg,
  type PortalTeacher,
} from '../admin-data'
import { ConfirmButton, EmptyState, ErrorState, Loading, Panel, Pill, RefreshButton } from '../admin-ui'
import { OutreachPanel } from './OutreachPanel'
import { ClubInvitesPanel } from '../invites/ClubInvitesPanel'
import { OrgApplicationsPanel } from './OrgApplicationsPanel'
import { useNavigate } from 'react-router-dom'
import { useTeacher } from '@/app/providers/teacher'
import { atHandle } from '@/lib/handles'
import { cn } from '@/lib/cn'

export function PortalsTab() {
  const teacherLoader = useCallback(() => adminListPortalTeachers(), [])
  const orgLoader = useCallback(() => adminListPortalOrgs(), [])
  const teachers = useAdminList<PortalTeacher>(teacherLoader)
  const orgs = useAdminList<PortalOrg>(orgLoader)
  const { switchOrg } = useTeacher()
  const navigate = useNavigate()

  /**
   * Open a club's portal as the platform.
   *
   * `switchOrg` makes it the active organisation and every management path
   * targets it; the admin is NOT added to its team to make that work — the
   * access comes from `is_admin()` in the database, so it leaves no trace on
   * the club's member list. See db/god_mode_invisible.sql.
   */
  const manage = (id: string) => {
    switchOrg(id)
    navigate('/organizer')
  }

  const reloadAll = () => {
    teachers.reload()
    orgs.reload()
  }

  const pendingOrgs = orgs.items.filter((o) => o.status === 'pending').length

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-semibold text-fg">Portals</h1>
          <p className="text-[13px] text-subtle">
            Manage teacher &amp; organizer accounts, and send invites.
            {pendingOrgs > 0 && <span className="ml-1 font-medium text-warning">{pendingOrgs} awaiting approval.</span>}
          </p>
        </div>
        <RefreshButton onClick={reloadAll} busy={teachers.loading || orgs.loading} />
      </header>

      {/* FIRST: the one way a club arrives. New invite → a link → they sign
          in and land in setup. Every invite ever made is listed here. */}
      <ClubInvitesPanel />

      {/* Directly under the links, because these are what the links produce. */}
      <OrgApplicationsPanel />

      {/* Primary: the lists you actually manage. Organizers get the wide column
          (most actions); teachers are compact beside them on large screens. */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Panel title="Organizations" sub={orgs.loading ? 'Loading…' : `${orgs.items.length} total`}>
          {orgs.loading ? (
            <Loading />
          ) : orgs.error ? (
            <ErrorState message={orgs.error} />
          ) : orgs.items.length === 0 ? (
            <EmptyState>No organizations yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {orgs.items.map((o) => (
                <OrgRow key={o.id} o={o} onChanged={orgs.reload} onManage={manage} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Teachers" sub={teachers.loading ? 'Loading…' : `${teachers.items.length} accounts`}>
          {teachers.loading ? (
            <Loading />
          ) : teachers.error ? (
            <ErrorState message={teachers.error} />
          ) : teachers.items.length === 0 ? (
            <EmptyState>No teacher accounts yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {teachers.items.map((t) => (
                <TeacherRow key={t.id} t={t} onChanged={teachers.reload} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* The older campaign links (utm-tagged links to the portal door). Kept
          because their numbers are real history; new clubs use invites above. */}
      <details className="group rounded-xl border border-border bg-surface">
        <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-semibold text-muted hover:text-fg">
          Campaign links <span className="font-normal text-subtle">· older outreach tracking</span>
        </summary>
        <div className="border-t border-border p-2">
          <OutreachPanel />
        </div>
      </details>
    </div>
  )
}

function TeacherRow({ t, onChanged }: { t: PortalTeacher; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
      onChanged()
    } catch {
      /* the row keeps its old state, which is the truth */
    }
    setBusy(false)
  }
  const remove = () => run(() => adminRemoveTeacher(t.id))
  const approved = t.status === 'approved'
  /* Approval is what lets a teacher publish verified outlines and post
     announcements; the database enforces it (db/teacher_gate.sql). A new
     account starts pending, so this button is how anybody becomes one. */
  const actions = (
    <>
      {approved ? (
        <ConfirmButton label="Back to pending" armedLabel="Confirm" disabled={busy} onConfirm={() => run(() => adminSetTeacherStatus(t.id, 'pending'))} />
      ) : (
        <ConfirmButton label="Approve" armedLabel="Confirm approve" disabled={busy} onConfirm={() => run(() => adminSetTeacherStatus(t.id, 'approved'))} />
      )}
      <ConfirmButton label="Remove" armedLabel="Confirm remove" danger disabled={busy} onConfirm={remove} />
    </>
  )
  // Stacks below sm. A name, two counters and a destructive button do not fit
  // 375px on one line, and flex-wrap alone left the button orphaned against the
  // right edge with the counters stranded above it.
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium text-fg">{t.name}</span>
          <Pill tone={t.status === 'approved' ? 'green' : 'amber'}>{t.status}</Pill>
        </div>
        <span className="truncate text-[12px] text-subtle">{t.email}</span>
      </div>
      <div className="flex items-center gap-4 text-[12px] text-subtle">
        <span title="Published blueprints" className="inline-flex items-center gap-1"><FileText size={13} aria-hidden />{t.blueprint_count}</span>
        <span title="Announcements" className="inline-flex items-center gap-1"><Megaphone size={13} aria-hidden />{t.announcement_count}</span>
        <span className="ml-auto flex gap-2 sm:hidden">{actions}</span>
      </div>
      <span className="hidden gap-2 sm:inline-flex">{actions}</span>
    </li>
  )
}

function OrgRow({
  o,
  onChanged,
  onManage,
}: {
  o: PortalOrg
  onChanged: () => void
  onManage: (id: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const banned = o.status === 'banned'

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
      onChanged()
    } catch {
      setBusy(false)
    }
  }

  /*
   * THREE ROWS, each with one job, so nothing is pushed off the right edge:
   * who it is (and its state), how to reach it, and what you can do. The old
   * single flex row clipped Delete at desktop widths and wrapped into a
   * tangle on a phone.
   */
  return (
    <li>
      <div className="px-4 py-3.5">
        <button
          type="button"
          onClick={() => onManage(o.id)}
          className="-mx-1 flex w-[calc(100%+0.5rem)] min-w-0 flex-col rounded-lg px-1 py-0.5 text-left transition-colors duration-150 hover:bg-surface-2"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate text-[14px] font-semibold text-fg">{o.name}</span>
            {o.verified && <BadgeCheck size={14} className="shrink-0 text-info" aria-label="Verified" />}
            <Pill tone={banned ? 'red' : o.status === 'approved' ? 'green' : 'amber'}>{o.status}</Pill>
          </span>
          {/* `atHandle`: organisations store the handle WITH its @. */}
          <span className="truncate text-[12px] text-subtle">
            {atHandle(o.handle)}
            {o.owner_email ? ` · ${o.owner_email}` : ''}
          </span>
        </button>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-4 text-[12px] text-subtle">
            <span title="Events" className="inline-flex items-center gap-1"><CalendarDays size={13} aria-hidden />{o.event_count}</span>
            <span title="Followers" className="inline-flex items-center gap-1"><Users size={13} aria-hidden />{o.follower_count}</span>
            <button type="button" onClick={() => setShowMembers((s) => !s)} aria-expanded={showMembers}
              className="inline-flex items-center gap-1 rounded-lg py-1 text-[12px] text-muted hover:text-fg">
              {o.member_count} member{o.member_count === 1 ? '' : 's'}
              <ChevronDown size={14} className={cn('transition-transform duration-200', showMembers && 'rotate-180')} aria-hidden />
            </button>
          </span>
          <span className="ml-auto flex flex-wrap items-center gap-2">
            {o.status === 'pending' && (
              <button type="button" disabled={busy} onClick={() => run(() => adminSetOrgStatus(o.id, 'approved'))}
                className="rounded-lg bg-accent px-2.5 py-1.5 text-[12px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-50">
                Approve
              </button>
            )}
            {banned ? (
              <button type="button" disabled={busy} onClick={() => run(() => adminSetOrgStatus(o.id, 'approved'))}
                className="rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg disabled:opacity-50">
                Unban
              </button>
            ) : (
              <ConfirmButton label="Ban" armedLabel="Confirm ban" danger disabled={busy} onConfirm={() => run(() => adminSetOrgStatus(o.id, 'banned'))} />
            )}
            <ConfirmButton label="Delete" armedLabel="Confirm delete" danger disabled={busy} onConfirm={() => run(() => adminDeleteOrg(o.id))} />
          </span>
        </div>
      </div>
      {showMembers && <OrgMembers orgId={o.id} onChanged={onChanged} />}
    </li>
  )
}

function OrgMembers({ orgId, onChanged }: { orgId: string; onChanged: () => void }) {
  const loader = useCallback(() => adminListOrgMembers(orgId), [orgId])
  const { items, loading, error, reload } = useAdminList<OrgMember>(loader)

  const remove = async (id: string) => {
    try {
      await adminRemoveOrgMember(id)
      reload()
      onChanged()
    } catch {
      /* surfaced via reload */
    }
  }

  return (
    <div className="border-t border-border bg-surface-2/30 px-4 py-3">
      {loading ? (
        <p className="py-2 text-center text-[12px] text-subtle">Loading members…</p>
      ) : error ? (
        <p className="py-2 text-center text-[12px] text-danger">{error}</p>
      ) : items.length === 0 ? (
        <p className="py-2 text-center text-[12px] text-subtle">No team members.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-md bg-surface px-3 py-2">
              <div className="min-w-0 flex-1">
                <span className="text-[12px] font-medium text-fg">{m.name || 'Member'}</span>
                <span className="ml-2 text-[11px] text-subtle">{m.email}</span>
              </div>
              <Pill tone={m.role === 'owner' ? 'blue' : 'neutral'}>{m.role}</Pill>
              {m.role !== 'owner' && (
                <ConfirmButton label="Remove" armedLabel="Confirm" danger onConfirm={() => remove(m.id)} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
