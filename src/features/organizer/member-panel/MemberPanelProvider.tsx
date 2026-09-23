import { useCallback, useMemo, useState } from 'react'
import { MemberPanelContext, type MemberRef } from './member-panel'
import { MemberPanel } from './MemberPanel'

/** Mounted once around the portal, so every screen opens the same panel and
 *  none of them has to render its own. */
export function MemberPanelProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<MemberRef | null>(null)
  const openMember = useCallback((ref: MemberRef) => setOpen(ref), [])
  const value = useMemo(() => ({ openMember }), [openMember])
  return (
    <MemberPanelContext.Provider value={value}>
      {children}
      {open && (
        <MemberPanel
          // A new person is a new panel: nothing from the last one's
          // confirmations or loaded history should carry over.
          key={open.memberId ?? open.userId ?? open.name}
          target={open}
          onClose={() => setOpen(null)}
        />
      )}
    </MemberPanelContext.Provider>
  )
}
