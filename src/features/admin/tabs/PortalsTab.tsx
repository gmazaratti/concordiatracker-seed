import { useCallback, useState } from 'react'
import { BadgeCheck, CalendarDays, ChevronDown, FileText, Megaphone, Plus, Users, X } from 'lucide-react'
import {
  adminDeleteOrg,
  adminListOrgMembers,
  adminListPortalOrgs,
  adminListPortalTeachers,
  adminRemoveOrgMember,
  adminRemoveTeacher,
  adminSetOrgStatus,
  useAdminList,
  type OrgMember,
  type PortalOrg,
  type PortalTeacher,
} from '../admin-data'
import { ConfirmButton, EmptyState, ErrorState, Loading, Panel, Pill, RefreshButton } from '../admin-ui'
import { OrgInvitesPanel } from './OrgInvitesPanel'
import { AdminCreateOrgPanel } from './AdminCreateOrgPanel'
import { cn } from '@/lib/cn'

export function PortalsTab() {
  const teacherLoader = useCallback(() => adminListPortalTeachers(), [])
  const orgLoader = useCallback(() => adminListPortalOrgs(), [])
  const teachers = useAdminList<PortalTeacher>(teacherLoader)
  const orgs = useAdminList<PortalOrg>(orgLoader)
  const [showCreate, setShowCreate] = useState(false)

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
                <OrgRow key={o.id} o={o} onChanged={orgs.reload} />
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

      {/* Invites: kept visible so you can see who's opened a link (before signup). */}
      <OrgInvitesPanel />

      {/* Creating a fresh org is rare → tucked behind a toggle so it doesn't
          dominate the tab. */}
      {showCreate ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-fg">Create a new organization</h2>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="inline-flex items-center gap-1 text-[12px] text-subtle transition-colors hover:text-fg"
            >
              <X size={13} aria-hidden />
              Hide
            </button>
          </div>
          <AdminCreateOrgPanel />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong px-4 py-3 text-[13px] font-medium text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
        >
          <Plus size={15} aria-hidden />
          Create a new organization (ownerless + handoff link)
        </button>
      )}
    </div>
  )
}

function TeacherRow({ t, onChanged }: { t: PortalTeacher; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const remove = async () => {
    setBusy(true)
    try {
      await adminRemoveTeacher(t.id)
      onChanged()
    } catch {
      setBusy(false)
    }
  }
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
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
      </div>
      <ConfirmButton label="Remove" armedLabel="Confirm remove" danger disabled={busy} onConfirm={remove} />
    </li>
  )
}

function OrgRow({ o, onChanged }: { o: PortalOrg; onChanged: () => void }) {
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

  return (
    <li>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-medium text-fg">{o.name}</span>
            {o.verified && <BadgeCheck size={14} className="shrink-0 text-info" aria-label="Verified" />}
            <Pill tone={banned ? 'red' : o.status === 'approved' ? 'green' : 'amber'}>{o.status}</Pill>
          </div>
          <span className="truncate text-[12px] text-subtle">@{o.handle}{o.owner_email ? ` · ${o.owner_email}` : ''}</span>
        </div>
        <div className="flex items-center gap-4 text-[12px] text-subtle">
          <span title="Events" className="inline-flex items-center gap-1"><CalendarDays size={13} aria-hidden />{o.event_count}</span>
          <span title="Followers" className="inline-flex items-center gap-1"><Users size={13} aria-hidden />{o.follower_count}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Manual gate: a freshly-invited org stays pending until approved here. */}
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
          <button type="button" onClick={() => setShowMembers((s) => !s)} aria-expanded={showMembers}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] text-muted hover:text-fg">
            {o.member_count} member{o.member_count === 1 ? '' : 's'}
            <ChevronDown size={14} className={cn('transition-transform duration-200', showMembers && 'rotate-180')} aria-hidden />
          </button>
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
