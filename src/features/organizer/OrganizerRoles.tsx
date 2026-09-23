import { useMemo, useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { deleteOrgRole, roleIdOf, type OrgRoleDef, type RoleDraft, type RolePreset } from '@/lib/org-roles'
import { isOwnerRank, useOrgRoles } from './use-org-roles'
import { RoleList } from './roles/RoleList'
import { RoleEditor } from './roles/RoleEditor'
import { RoleMembers } from './roles/RoleMembers'
import { NewRoleMenu } from './roles/NewRoleMenu'
import { DeleteRoleDialog } from './roles/DeleteRoleDialog'
import { cn } from '@/lib/cn'

/**
 * `/organizer/roles` — three rails: the roles, one role's permissions, and the
 * people who hold it.
 *
 * NOTHING HERE DECIDES ANYTHING. Every save calls a SECURITY DEFINER verb that
 * re-checks the hierarchy, and the team table itself refuses a direct write
 * that would climb it (db/org_member_guard.sql). The checks on this page make
 * a refusal rare; they are not the defence.
 *
 * On a phone the three rails are three steps: the list, then the role with
 * its holders under it, with a way back.
 */
export function OrganizerRoles() {
  const { currentOrg, orgPerms, refreshOrgs } = useTeacher()
  const orgId = currentOrg?.id ?? ''
  const { roles, mine, error, refresh } = useOrgRoles(orgId || undefined)
  const [picked, setPicked] = useState<string | null>(null)
  const [creating, setCreating] = useState<{ key: number; seed: RoleDraft } | null>(null)
  const [draftName, setDraftName] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [deleting, setDeleting] = useState<OrgRoleDef | null>(null)

  const holders = useMemo(() => {
    const by = new Map<string, NonNullable<typeof currentOrg>['members']>()
    for (const m of currentOrg?.members ?? []) {
      const id = roleIdOf(m, orgId, roles)
      if (!id) continue
      by.set(id, [...(by.get(id) ?? []), m])
    }
    return (id: string) => by.get(id) ?? []
  }, [currentOrg, orgId, roles])

  if (!currentOrg) return null

  const canEdit = isOwnerRank(mine) || !!orgPerms?.roles_grant
  const top = Math.max(1, Math.min(mine - 1, 99))
  // Default to the first role you could actually change — the reason anybody
  // opens this page — else the top of the list.
  const fallback = roles?.find((r) => !r.isOwner && r.position < mine) ?? roles?.[0] ?? null
  const role = creating ? null : (roles?.find((r) => r.id === picked) ?? fallback)

  function startNew(seed: RoleDraft) {
    setCreating({ key: Date.now(), seed: { ...seed, position: Math.min(seed.position, top) } })
    setDraftName(seed.name)
    setMobileOpen(true)
  }

  const seed: RoleDraft | null = creating
    ? creating.seed
    : role
      ? { name: role.name, color: role.color, icon: role.icon, position: role.position, permissions: role.permissions, canViewActivity: role.canViewActivity }
      : null

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 py-5 sm:px-6">
      <header className={cn('flex flex-wrap items-end justify-between gap-3', mobileOpen && 'max-lg:hidden')}>
        <div>
          <h1 className="font-display text-[22px] font-semibold text-fg">Roles</h1>
          <p className="mt-1 max-w-xl text-[13px] text-muted">
            What each person on your team may do. You can change any role below your own — never
            your own, and never one above it.
          </p>
        </div>
        {roles && (
          <NewRoleMenu
            roles={roles}
            mine={mine}
            disabled={!canEdit}
            onBlank={() =>
              startNew({ name: '', color: '#8fb39a', icon: 'Shield', position: Math.min(20, top), permissions: {}, canViewActivity: false })
            }
            onPreset={(p: RolePreset) =>
              startNew({ name: p.name, color: p.color, icon: p.icon, position: p.position, permissions: p.permissions, canViewActivity: p.canViewActivity })
            }
          />
        )}
      </header>

      {error && <p className="mt-4 text-[13px] text-danger">{error}</p>}

      {!roles ? (
        <div className="grid min-h-[40vh] place-items-center">
          <Loader2 className="size-5 animate-spin text-accent" aria-label="Loading" />
        </div>
      ) : (
        <div className="mt-5 lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)_16rem] lg:items-start lg:gap-5">
          <aside className={cn(mobileOpen && 'max-lg:hidden', 'lg:sticky lg:top-0 lg:max-h-[calc(100svh-9rem)] lg:overflow-y-auto lg:pr-1')}>
            <RoleList
              roles={roles}
              mine={mine}
              selected={creating ? null : (role?.id ?? null)}
              holders={holders}
              draftName={creating ? draftName : null}
              onSelect={(id) => {
                setCreating(null)
                setPicked(id)
                setMobileOpen(true)
              }}
            />
          </aside>

          <section className={cn('rounded-2xl border border-border bg-surface p-4 sm:p-5', !mobileOpen && 'max-lg:hidden')}>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false)
                setCreating(null)
              }}
              className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-fg lg:hidden"
            >
              <ArrowLeft size={16} aria-hidden />
              All roles
            </button>
            {seed && (
              <RoleEditor
                key={creating ? `new-${creating.key}` : role?.id}
                orgId={orgId}
                role={role}
                seed={seed}
                mine={mine}
                canEdit={canEdit}
                onSaved={(saved) => {
                  setCreating(null)
                  setPicked(saved.id)
                  refresh()
                  refreshOrgs()
                }}
                onCancelNew={() => {
                  setCreating(null)
                  setMobileOpen(false)
                }}
                onDelete={() => role && setDeleting(role)}
                onNameChange={creating ? setDraftName : undefined}
                others={roles.filter((r) => r.id !== role?.id)}
              />
            )}
          </section>

          <aside
            className={cn(
              'mt-4 rounded-2xl border border-border bg-surface p-4 lg:sticky lg:top-0 lg:mt-0',
              !mobileOpen && 'max-lg:hidden',
            )}
          >
            <h2 className="mb-2.5 flex items-baseline justify-between text-[11px] font-semibold tracking-wide text-subtle uppercase">
              Who has it
              {role && <span className="font-normal normal-case tracking-normal">{holders(role.id).length}</span>}
            </h2>
            <RoleMembers role={role} people={role ? holders(role.id) : []} />
          </aside>
        </div>
      )}

      {deleting && (
        <DeleteRoleDialog
          role={deleting}
          holders={holders(deleting.id)}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteOrgRole(deleting.id)
            setDeleting(null)
            setPicked(null)
            refresh()
            refreshOrgs()
          }}
        />
      )}
    </div>
  )
}
