import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Loader2, RotateCcw, ShieldAlert, Undo2 } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import {
  loadActivity,
  loadActivityActors,
  revertActivity,
  revertAllFrom,
  type ActivityActor,
  type ActivityEntry,
} from '@/lib/org-roles'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { formatFull } from '@/lib/date'
import { cn } from '@/lib/cn'
import { useMemberPanel } from './member-panel/member-panel'
import { MemberAvatar } from './MemberAvatar'
import { RoleGlyph } from './RoleChip'
import { useOrgRoles } from './use-org-roles'
import { roleIdOf, type OrgRoleDef } from '@/lib/org-roles'
import type { OrgMember } from '@/data/teacher'

/**
 * `/organizer/activity` — who did what, and how to put it back.
 *
 * WHY IT IS WORTH A TAB. A club's account is shared by an exec that turns over
 * every year, and the question that actually gets asked is never "what changed"
 * in the abstract — it is "who moved the event" and "can we undo it". Both need
 * the same record, which is why the log stores the state BEFORE each change
 * rather than a sentence describing it.
 *
 * UNDO IS OFFERED ONLY WHERE IT IS REAL. The server decides `canRevert` — a
 * story that expired and a notification that was delivered are gone, and a
 * button promising to bring them back would be a lie. So the client renders
 * what it is told rather than working it out and being wrong.
 */
export function OrganizerActivity() {
  const { currentOrg } = useTeacher()
  const orgId = currentOrg?.id ?? ''
  const [rows, setRows] = useState<ActivityEntry[] | null>(null)
  const [actors, setActors] = useState<ActivityActor[]>([])
  const [err, setErr] = useState('')
  const [tick, setTick] = useState(0)
  const [bulk, setBulk] = useState(false)
  const { roles } = useOrgRoles(orgId || undefined)

  useEffect(() => {
    if (!orgId) return
    let alive = true
    void Promise.all([loadActivity(orgId), loadActivityActors(orgId)])
      .then(([r, a]) => {
        if (!alive) return
        // Cleared here rather than at the top of the effect: a synchronous
        // setState in an effect body is a cascading render, and the previous
        // error should stay on screen until there is an answer to replace it.
        setErr('')
        setRows(r)
        setActors(a)
      })
      .catch((e: unknown) => {
        if (!alive) return
        // A refusal here is the visibility switch doing its job, not a fault.
        setErr(e instanceof Error ? e.message : 'Could not load the activity log.')
        setRows([])
      })
    return () => {
      alive = false
    }
  }, [orgId, tick])

  const refresh = useCallback(() => setTick((t) => t + 1), [])
  if (!currentOrg) return null

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-semibold text-fg">Activity</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            Everything anybody on the team has done here, newest first. Owners always see this;
            every other role has a switch on it.
          </p>
        </div>
        {actors.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setBulk((b) => !b)}>
            <ShieldAlert size={15} aria-hidden />
            Undo a run of changes
          </Button>
        )}
      </header>

      {bulk && (
        <BulkRevert orgId={orgId} actors={actors} onDone={() => { setBulk(false); refresh() }} />
      )}

      {err && (
        <p className="mt-4 rounded-xl border border-border bg-surface px-3.5 py-3 text-[13px] text-muted">
          {err}
        </p>
      )}

      {rows === null ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Loader2 className="size-5 animate-spin text-accent" aria-label="Loading" />
        </div>
      ) : rows.length === 0 && !err ? (
        <p className="mt-6 rounded-xl border border-dashed border-border-strong bg-surface/50 px-5 py-8 text-center text-[13px] text-subtle">
          Nothing yet. Every change anybody makes from here on shows up on this page.
        </p>
      ) : (
        <ol className="mt-5 flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {rows.map((r) => {
            const member = currentOrg.members.find((m) => !!r.actorUser && m.userId === r.actorUser)
            const role = member ? roles?.find((x) => x.id === roleIdOf(member, orgId, roles)) : undefined
            return <Row key={r.id} entry={r} member={member} role={role} onChanged={refresh} />
          })}
        </ol>
      )}
    </div>
  )
}

function Row({
  entry,
  member,
  role,
  onChanged,
}: {
  entry: ActivityEntry
  /** Who did it, when they are still on the team: their face and role. */
  member?: OrgMember
  role?: OrgRoleDef
  onChanged: () => void
}) {
  const { openMember } = useMemberPanel()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const undone = !!entry.revertedAt

  return (
    <li className={cn('flex items-start gap-3 px-3.5 py-3', undone && 'opacity-60')}>
      <MemberAvatar
        member={member ?? { name: entry.actorName, email: entry.actorEmail }}
        className="mt-0.5 size-8"
        textClass="text-[11px]"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] text-fg">
          {entry.actorUser ? (
            <button
              type="button"
              onClick={() => openMember({ userId: entry.actorUser, name: entry.actorName })}
              className="inline-flex items-center gap-1 rounded font-semibold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
              style={role ? { color: role.color } : undefined}
              title={role ? `${entry.actorName} · ${role.name}` : entry.actorName}
            >
              {role && <RoleGlyph role={role} bare />}
              {entry.actorName}
            </button>
          ) : (
            <span className="font-medium">{entry.actorName}</span>
          )}{' '}
          {entry.action}
          {undone && <span className="ml-1.5 text-[11.5px] text-subtle">· undone</span>}
        </p>
        {entry.detail && (
          <p className="mt-0.5 truncate text-[12px] text-subtle">{entry.detail}</p>
        )}
        <p className="mt-0.5 text-[11.5px] text-subtle">{formatFull(entry.createdAt)}</p>
        {err && <p className="mt-1 text-[11.5px] text-danger">{err}</p>}
      </div>
      {entry.canRevert && !undone && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            setErr('')
            void revertActivity(entry.id)
              .then(onChanged)
              .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Could not undo.'))
              .finally(() => setBusy(false))
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg disabled:opacity-50"
        >
          {busy ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Undo2 size={12} aria-hidden />}
          Undo
        </button>
      )}
    </li>
  )
}

/* ── Undo everything one person did ───────────────────────────────────────── */

/**
 * The heavy one, and it reads like it.
 *
 * TWO DELIBERATE OBSTACLES: the range has to be filled in (there is no "all
 * time" button, because the overwhelmingly common case is "since Tuesday" and
 * the rare one should cost a date), and the warning is the plain sentence
 * asked for rather than a soft one. It is owner-only in the database, so this
 * panel is a way to reach that rule, never the rule itself.
 */
function BulkRevert({
  orgId,
  actors,
  onDone,
}: {
  orgId: string
  actors: ActivityActor[]
  onDone: () => void
}) {
  const [who, setWho] = useState(actors[0]?.actorUser ?? '')
  // Instants, not bare dates: the custom picker (a native date input on iOS
  // has a minimum width that ran past the card) carries a time too, which is
  // also the more precise answer to "since when".
  const [from, setFrom] = useState<string | null>(null)
  const [to, setTo] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<number | null>(null)

  const name = actors.find((a) => a.actorUser === who)?.actorName ?? 'them'

  if (done !== null) {
    return (
      <div className="mt-4 rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3">
        <p className="text-[13.5px] font-medium text-fg">
          {done === 0
            ? `Nothing from ${name} in that window could be undone.`
            : `Put back ${done} change${done === 1 ? '' : 's'} from ${name}.`}
        </p>
        <Button size="sm" className="mt-2" onClick={onDone}>
          Done
        </Button>
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-2xl border border-danger/40 bg-surface p-4">
      <p className="flex items-center gap-1.5 text-[14px] font-semibold text-fg">
        <RotateCcw size={15} aria-hidden />
        Undo every change from one person
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block min-w-0">
          <span className="mb-1 block text-[12px] font-medium text-muted">Who</span>
          <Select
            value={who}
            onChange={setWho}
            ariaLabel="Whose changes to undo"
            options={actors.map((a) => ({
              value: a.actorUser,
              label: `${a.actorName} · ${a.actions}`,
            }))}
          />
        </label>
        <div className="min-w-0">
          <span className="mb-1 block text-[12px] font-medium text-muted">From</span>
          <DateTimePicker value={from} onChange={setFrom} ariaLabel="From" clearable />
        </div>
        <div className="min-w-0">
          <span className="mb-1 block text-[12px] font-medium text-muted">To</span>
          <DateTimePicker value={to} onChange={setTo} ariaLabel="To" clearable />
        </div>
      </div>

      <p className="mt-3 flex items-start gap-2 rounded-xl bg-danger/10 px-3 py-2.5 text-[12.5px] leading-relaxed text-danger">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          <strong className="font-semibold">This can not be undone.</strong> Every change{' '}
          {name} made in that window goes back to how it was before, and anything they did
          after it that built on those changes goes with it.
        </span>
      </p>

      {err && <p className="mt-2 text-[12.5px] text-danger">{err}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg px-3 py-2 text-[13px] font-medium text-subtle transition-colors hover:text-fg"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!who || !from || busy}
          onClick={() => {
            if (!confirm) {
              setConfirm(true)
              return
            }
            setBusy(true)
            setErr('')
            void revertAllFrom(
              orgId,
              who,
              from,
              to,
            )
              .then(setDone)
              .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Could not undo.'))
              .finally(() => setBusy(false))
          }}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-danger px-3 py-2 text-[13px] font-medium text-white transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
        >
          {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
          {confirm ? `Yes — undo everything from ${name}` : 'Undo them all'}
        </button>
      </div>
    </div>
  )
}
