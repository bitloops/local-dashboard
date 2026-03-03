import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

interface NavigationContext {
  pathname: string
  navigate: (to: string) => void
}

const NavigationCtx = createContext<NavigationContext | null>(null)

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [pathname, setPathname] = useState('/')

  const navigate = useCallback((to: string) => {
    setPathname(to)
  }, [])

  const value = useMemo(
    () => ({ pathname, navigate }),
    [pathname, navigate]
  )

  return (
    <NavigationCtx.Provider value={value}>
      {children}
    </NavigationCtx.Provider>
  )
}

export function useNavigate() {
  const ctx = use(NavigationCtx)
  if (!ctx) throw new Error('useNavigate must be used within NavigationProvider')
  return ctx.navigate
}

export function useLocation() {
  const ctx = use(NavigationCtx)
  if (!ctx) throw new Error('useLocation must be used within NavigationProvider')
  return { pathname: ctx.pathname }
}
