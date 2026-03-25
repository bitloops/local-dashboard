import { DashboardView } from './dashboard-view'
import { useDashboardData } from './use-dashboard-data'

export function Dashboard() {
  const viewProps = useDashboardData()
  return <DashboardView {...viewProps} />
}
