import {
  MessageSquare,
  Search,
  Settings,
  HelpCircle,
  Command,
  Building2,
  Network,
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
          title: 'Sessions',
          url: '/',
          icon: MessageSquare,
        },
        {
          title: 'Query Explorer',
          url: '/explorer',
          icon: Search,
        },
        {
          title: 'Code Atlas',
          url: '/code-city',
          icon: Building2,
        },
        {
          title: 'Architecture',
          url: '/architecture',
          icon: Network,
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
