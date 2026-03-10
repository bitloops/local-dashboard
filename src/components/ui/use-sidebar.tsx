import { createContext, use } from 'react'

export type SidebarContextProps = {
  state: 'expanded' | 'collapsed'
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
  /** Right sidebar (e.g. checkpoint panel) */
  rightOpen: boolean
  setRightOpen: (open: boolean) => void
  rightOpenMobile: boolean
  setRightOpenMobile: (open: boolean) => void
  toggleRightSidebar: () => void
}

export const SidebarContext = createContext<SidebarContextProps | null>(null)

export function useSidebar() {
  const context = use(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider.')
  }

  return context
}
