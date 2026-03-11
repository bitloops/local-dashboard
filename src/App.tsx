import { useLocation } from '@/context/use-navigation'
import { LayoutProvider } from '@/context/layout-provider'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SkipToMain } from '@/components/skip-to-main'
import { Dashboard } from '@/features/dashboard'
import { QueryExplorer } from '@/features/query-explorer'
import { SettingsPage } from '@/features/settings/page'
import { ComingSoon } from '@/components/coming-soon'

function PageRouter() {
  const { pathname } = useLocation()

  if (pathname === '/' || pathname === '') return <Dashboard />
  if (pathname === '/explorer') return <QueryExplorer />
  if (pathname.startsWith('/settings')) return <SettingsPage />
  if (pathname === '/help-center') return <ComingSoon />

  return <Dashboard />
}

export function App() {
  const defaultOpen = getCookie('sidebar_state') !== 'false'

  return (
    <LayoutProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <SkipToMain />
        <AppSidebar />
        <SidebarInset
          className={cn(
            '@container/content',
            'has-data-[layout=fixed]:h-svh',
            'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]',
          )}
        >
          <PageRouter />
        </SidebarInset>
      </SidebarProvider>
    </LayoutProvider>
  )
}
