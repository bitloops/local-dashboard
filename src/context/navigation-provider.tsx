import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { NavigationContext } from './use-navigation'

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
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  )
}
