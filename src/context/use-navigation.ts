import { createContext, use } from 'react'

interface NavigationContextValue {
  pathname: string
  navigate: (to: string) => void
}

export const NavigationContext = createContext<NavigationContextValue | null>(null)

export function useNavigate() {
  const ctx = use(NavigationContext)
  if (!ctx) throw new Error('useNavigate must be used within NavigationProvider')
  return ctx.navigate
}

export function useLocation() {
  const ctx = use(NavigationContext)
  if (!ctx) throw new Error('useLocation must be used within NavigationProvider')
  return { pathname: ctx.pathname }
}
