import {
  LayoutDashboard,
  Search,
  Settings,
  HelpCircle,
  Command,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  teams: [
    {
      name: 'Bitloops',
      logo: Command,
      plan: 'Local Dashboard',
    },
  ],
  navGroups: [
    {
      title: 'General',
      items: [
        {
          title: 'Dashboard',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'Query Explorer',
          url: '/explorer',
          icon: Search,
        },
      ],
    },
    {
      title: 'Other',
      items: [
        {
          title: 'Settings',
          url: '/settings',
          icon: Settings,
        },
        {
          title: 'Help',
          url: '/help-center',
          icon: HelpCircle,
        },
      ],
    },
  ],
}
