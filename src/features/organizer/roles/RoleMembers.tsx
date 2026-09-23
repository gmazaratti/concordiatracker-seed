import { ChevronRight } from 'lucide-react'
import type { OrgMember } from '@/data/teacher'
import type { OrgRoleDef } from '@/lib/org-roles'
import { MemberAvatar } from '../MemberAvatar'
import { useMemberPanel } from '../member-panel/member-panel'

/** The right rail: who holds the selected role. Each face opens that
 *  person's panel, which is where their role is actually changed. */
export function RoleMembers({ role, people }: { role: OrgRoleDef | null; people: OrgMember[] }) {
  const { openMember } = useMemberPanel()
  if (!role) {
    return <p className="text-[12.5px] text-subtle">Save the role, then hand it to people from their profile or the Team page.</p>
  }
  if (people.length === 0) {
    return (
      <p className="text-[12.5px] leading-snug text-subtle">
        Nobody holds {role.name} yet. Open a teammate to give it to them.
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-1">
      {people.map((m) => (
        <li key={m.id}>
          <button
            type="button"
            onClick={() => openMember({ memberId: m.id })}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 hover:bg-surface-2"
          >
            <MemberAvatar member={m} className="size-8" textClass="text-[11px]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-fg">
                {m.name}
                {m.isYou && <span className="ml-1.5 text-[11px] font-normal text-accent">you</span>}
              </span>
              <span className="block truncate text-[11.5px] text-subtle">
                {m.status === 'invited' ? 'Invited' : m.title || m.email}
              </span>
            </span>
            <ChevronRight size={15} className="shrink-0 text-subtle" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )
}
