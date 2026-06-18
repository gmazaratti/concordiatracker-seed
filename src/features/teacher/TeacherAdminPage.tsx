import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownUp, ExternalLink, MailCheck, Search, ShieldCheck } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useTeacher } from '@/app/providers/teacher'
import {
  expiresInLabel,
  inviteStatus,
  type AccessRequest,
  type OrgAccount,
  type OrgInvite,
  type RequestStatus,
  type TeacherAccount,
  type TeacherInvite,
} from '@/data/teacher'
import { Select } from '@/components/ui/Select'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { Button } from '@/components/ui/Button'
import { StatusChip } from '@/layouts/TeacherLayout'
import { OrgLogo } from '@/features/community/OrgLogo'
import { cn } from '@/lib/cn'

/** Admin console (you) — the two gates: originate invites (who gets in) + approve
 * teachers (when they can publish). Openly reachable in the seed; the underlying
 * invite-email + approval are connection-phase. */
export function TeacherAdminPage() {
  const { courses } = useAppData()
  const {
    teachers,
    approveTeacher,
    invites,
    createInvite,
    accessRequests,
    setRequestStatus,
    orgs,
    approveOrg,
    orgInvites,
    createOrgInvite,
  } = useTeacher()
  const [courseId, setCourseId] = useState('')
  const [email, setEmail] = useState('')
  const [generated, setGenerated] = useState<TeacherInvite | null>(null)
  const [reqQuery, setReqQuery] = useState('')
  const [sortDesc, setSortDesc] = useState(true)

  const q = reqQuery.trim().toLowerCase()
  const visibleRequests = accessRequests
    .filter(
      (r) =>
        !q ||
        r.caseId.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q),
    )
    .sort((a, b) => {
      const cmp = a.caseId.localeCompare(b.caseId, undefined, { numeric: true })
      return sortDesc ? -cmp : cmp
    })

  const course = courses.find((c) => c.id === courseId)
  const options = courses.map((c) => ({ value: c.id, label: `${c.code} · ${c.section} — ${c.title}` }))

  function pickCourse(id: string) {
    setCourseId(id)
    const c = courses.find((x) => x.id === id)
    if (c) setEmail(c.instructor.email)
    setGenerated(null)
  }
  function generate() {
    if (!course || !email.trim()) return
    setGenerated(
      createInvite({
        courseId: course.id,
        code: course.code,
        title: course.title,
        section: course.section,
        teacherName: course.instructor.name,
        recipientEmail: email.trim(),
      }),
    )
  }

  const field =
    'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-6 sm:px-6">
      <header className="flex items-center gap-2">
        <ShieldCheck size={20} className="text-accent" aria-hidden />
        <h1 className="font-display text-[24px] leading-tight font-semibold text-fg">Admin console</h1>
      </header>
      <p className="mt-0.5 text-[13px] text-subtle">
        Originate invites and approve teachers &amp; organizers — the two gates.
      </p>

      {/* Create invite */}
      <Block title="Create an invite">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className="mb-1 block text-[12px] font-medium text-muted">Course &amp; section</span>
              <Select
                ariaLabel="Course"
                value={courseId}
                onChange={pickCourse}
                options={options}
                placeholder="Pick a course…"
              />
            </label>
            <label className="flex-1">
              <span className="mb-1 block text-[12px] font-medium text-muted">Recipient email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prof@concordia.ca"
                className={field}
              />
            </label>
            <Button disabled={!course || !email.trim()} onClick={generate}>
              Generate invite
            </Button>
          </div>
          {course && (
            <p className="mt-2 text-[11px] text-subtle">
              Pre-fills <span className="text-fg">{course.instructor.name}</span> as the teacher for{' '}
              {course.code} · {course.section}.
            </p>
          )}

          {generated && <GeneratedInvite invite={generated} />}
        </div>
      </Block>

      {/* Create org invite */}
      <Block title="Invite an organizer">
        <OrgInviteForm createOrgInvite={createOrgInvite} field={field} />
      </Block>

      {/* Access requests */}
      <Block title={`Access requests · ${accessRequests.length}`}>
        <div className="mb-2 flex gap-2">
          <div className="relative flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle"
              aria-hidden
            />
            <input
              value={reqQuery}
              onChange={(e) => setReqQuery(e.target.value)}
              placeholder="Search by case ID, name, or email"
              aria-label="Search requests"
              className={cn(field, 'pl-9')}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setSortDesc((v) => !v)}>
            <ArrowDownUp size={14} aria-hidden />
            Case ID {sortDesc ? '↓' : '↑'}
          </Button>
        </div>
        {visibleRequests.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-strong bg-surface/50 px-4 py-6 text-center text-[13px] text-subtle">
            {q ? 'No requests match your search.' : 'No access requests yet.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visibleRequests.map((r) => (
              <RequestRow
                key={r.caseId}
                req={r}
                onAccept={() => setRequestStatus(r.caseId, 'accepted')}
                onDeny={() => setRequestStatus(r.caseId, 'denied')}
              />
            ))}
          </ul>
        )}
      </Block>

      {/* Teachers */}
      <Block title={`Teachers · ${teachers.length}`}>
        <ul className="flex flex-col gap-2">
          {teachers.map((t) => (
            <TeacherRow key={t.id} teacher={t} onApprove={() => approveTeacher(t.id)} />
          ))}
        </ul>
      </Block>

      {/* Invites */}
      <Block title={`Teacher invites · ${invites.length}`}>
        <ul className="flex flex-col gap-2">
          {invites.map((inv) => (
            <InviteRow key={inv.token} invite={inv} />
          ))}
        </ul>
      </Block>

      {/* Organizations */}
      <Block title={`Organizations · ${orgs.length}`}>
        <ul className="flex flex-col gap-2">
          {orgs.map((o) => (
            <OrgRow key={o.id} org={o} onApprove={() => approveOrg(o.id)} />
          ))}
        </ul>
      </Block>

      {/* Org invites */}
      <Block title={`Organizer invites · ${orgInvites.length}`}>
        {orgInvites.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-strong bg-surface/50 px-4 py-6 text-center text-[13px] text-subtle">
            No organizer invites yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {orgInvites.map((inv) => (
              <OrgInviteRow key={inv.token} invite={inv} />
            ))}
          </ul>
        )}
      </Block>
    </div>
  )
}

function OrgInviteForm({
  createOrgInvite,
  field,
}: {
  createOrgInvite: ReturnType<typeof useTeacher>['createOrgInvite']
  field: string
}) {
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [email, setEmail] = useState('')
  const [color, setColor] = useState('#5b9cf6')
  const [generated, setGenerated] = useState<OrgInvite | null>(null)

  const glyph =
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'OR'

  function generate() {
    if (!name.trim() || !email.trim()) return
    const h = handle.trim() ? (handle.trim().startsWith('@') ? handle.trim() : `@${handle.trim()}`) : `@${name.trim().toLowerCase().replace(/\s+/g, '')}`
    setGenerated(
      createOrgInvite({
        orgName: name.trim(),
        orgHandle: h,
        glyph,
        color,
        recipientEmail: email.trim(),
      }),
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1 block text-[12px] font-medium text-muted">Org name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Robotics Society" className={field} />
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-[12px] font-medium text-muted">Handle</span>
          <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@conu.robotics" className={field} />
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-[12px] font-medium text-muted">Recipient email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="team@org.ca" className={field} />
        </label>
        <div>
          <span className="mb-1 block text-[12px] font-medium text-muted">Colour</span>
          <ColorPicker value={color} onChange={setColor} ariaLabel="Org brand colour" />
        </div>
        <Button disabled={!name.trim() || !email.trim()} onClick={generate}>
          Generate invite
        </Button>
      </div>
      {generated && <GeneratedOrgInvite invite={generated} />}
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">{title}</h2>
      {children}
    </section>
  )
}

function GeneratedInvite({ invite }: { invite: TeacherInvite }) {
  const path = `/teacher/invite/${invite.token}`
  return (
    <div className="mt-3 rounded-lg border border-success/30 bg-success/10 p-3.5">
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-success">
        <MailCheck size={15} aria-hidden />
        Invite sent to {invite.recipientEmail} <span className="text-subtle">(email stubbed)</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded bg-surface-2 px-2 py-1 text-[11px] text-muted">{path}</code>
        <Link
          to={path}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
        >
          <ExternalLink size={13} aria-hidden />
          Open invite
        </Link>
      </div>
      <p className="mt-1.5 text-[11px] text-subtle">
        Single-use · {expiresInLabel(invite).toLowerCase()}.
      </p>
    </div>
  )
}

function TeacherRow({ teacher, onApprove }: { teacher: TeacherAccount; onApprove: () => void }) {
  const coursesLabel = teacher.courses.map((c) => `${c.code} · ${c.section}`).join(', ') || '—'
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-surface px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-fg">{teacher.name}</span>
          <StatusChip status={teacher.status} />
        </div>
        <p className="truncate text-[12px] text-subtle">
          {teacher.email} · {coursesLabel}
        </p>
      </div>
      {teacher.status === 'pending' && (
        <Button size="sm" onClick={onApprove}>
          Approve
        </Button>
      )}
    </li>
  )
}

function InviteRow({ invite }: { invite: TeacherInvite }) {
  const status = inviteStatus(invite)
  const tone =
    status === 'valid' ? 'text-muted' : status === 'used' ? 'text-success' : 'text-warning'
  const label =
    status === 'used' ? 'Used' : status === 'expired' ? 'Expired' : expiresInLabel(invite)
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-fg">{invite.recipientEmail}</p>
        <p className="truncate text-[12px] text-subtle">
          {invite.teacherName} · {invite.code} · {invite.section}
        </p>
      </div>
      <span className={`text-[12px] font-medium ${tone}`}>{label}</span>
      {status === 'valid' && (
        <Link
          to={`/teacher/invite/${invite.token}`}
          className="text-[12px] font-medium text-accent hover:underline"
        >
          Open
        </Link>
      )}
    </li>
  )
}

function GeneratedOrgInvite({ invite }: { invite: OrgInvite }) {
  const path = `/organizer/invite/${invite.token}`
  return (
    <div className="mt-3 rounded-lg border border-success/30 bg-success/10 p-3.5">
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-success">
        <MailCheck size={15} aria-hidden />
        Invite sent to {invite.recipientEmail} <span className="text-subtle">(email stubbed)</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded bg-surface-2 px-2 py-1 text-[11px] text-muted">{path}</code>
        <Link
          to={path}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
        >
          <ExternalLink size={13} aria-hidden />
          Open invite
        </Link>
      </div>
      <p className="mt-1.5 text-[11px] text-subtle">
        {invite.orgName} · {invite.orgHandle} · single-use · {expiresInLabel(invite).toLowerCase()}.
      </p>
    </div>
  )
}

function OrgRow({ org, onApprove }: { org: OrgAccount; onApprove: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-surface px-3.5 py-2.5">
      <OrgLogo org={org.org} className="size-8" rounded="rounded-lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-fg">{org.org.name}</span>
          <StatusChip status={org.status} />
        </div>
        <p className="truncate text-[12px] text-subtle">
          {org.email} · {org.events.length} event{org.events.length === 1 ? '' : 's'}
        </p>
      </div>
      {org.status === 'pending' && (
        <Button size="sm" onClick={onApprove}>
          Approve
        </Button>
      )}
    </li>
  )
}

function OrgInviteRow({ invite }: { invite: OrgInvite }) {
  const status = inviteStatus(invite)
  const tone =
    status === 'valid' ? 'text-muted' : status === 'used' ? 'text-success' : 'text-warning'
  const label =
    status === 'used' ? 'Used' : status === 'expired' ? 'Expired' : expiresInLabel(invite)
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-fg">{invite.recipientEmail}</p>
        <p className="truncate text-[12px] text-subtle">
          {invite.orgName} · {invite.orgHandle}
        </p>
      </div>
      <span className={`text-[12px] font-medium ${tone}`}>{label}</span>
      {status === 'valid' && (
        <Link
          to={`/organizer/invite/${invite.token}`}
          className="text-[12px] font-medium text-accent hover:underline"
        >
          Open
        </Link>
      )}
    </li>
  )
}

const REQ_STYLE: Record<RequestStatus, string> = {
  pending: 'bg-warning/15 text-warning',
  accepted: 'bg-success/15 text-success',
  denied: 'bg-danger/15 text-danger',
}

function reqAgo(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

function RequestRow({
  req,
  onAccept,
  onDeny,
}: {
  req: AccessRequest
  onAccept: () => void
  onDeny: () => void
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-surface px-3.5 py-2.5">
      <span className="shrink-0 font-mono text-[12px] text-subtle tabular-nums">{req.caseId}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-fg">{req.name}</span>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted capitalize">
            {req.role}
          </span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
              REQ_STYLE[req.status],
            )}
          >
            {req.status}
          </span>
        </div>
        <p className="truncate text-[12px] text-subtle">
          {req.email}
          {req.message ? ` · ${req.message}` : ''}
        </p>
      </div>
      <span className="shrink-0 text-[11px] text-subtle">{reqAgo(req.requestedDaysAgo)}</span>
      {req.status === 'pending' && (
        <span className="flex shrink-0 gap-2">
          <Button size="sm" onClick={onAccept}>
            Accept
          </Button>
          <Button size="sm" variant="outline" onClick={onDeny}>
            Deny
          </Button>
        </span>
      )}
    </li>
  )
}
