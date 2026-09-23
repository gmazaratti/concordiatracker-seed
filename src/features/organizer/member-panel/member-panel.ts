import { createContext, useContext } from 'react'

/**
 * Who to show. A member row id when we have one; a user id when all we have
 * is a name in the audit log (somebody who has since left still appears there,
 * and the panel says so rather than showing nothing).
 */
export interface MemberRef {
  memberId?: string
  userId?: string | null
  name?: string
}

export const MemberPanelContext = createContext<{ openMember: (ref: MemberRef) => void }>({
  openMember: () => undefined,
})

/** Open the member sidebar from anywhere a teammate's name appears. */
export const useMemberPanel = () => useContext(MemberPanelContext)
