import { createContext, useContext } from 'react'

export interface SupportContextValue {
  open: boolean
  openSupport: () => void
  closeSupport: () => void
}

export const SupportContext = createContext<SupportContextValue | null>(null)

export function useSupport(): SupportContextValue {
  const ctx = useContext(SupportContext)
  if (!ctx) throw new Error('useSupport must be used within <SupportProvider>')
  return ctx
}
