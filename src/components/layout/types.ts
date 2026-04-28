type Team = {
  name: string
  logo: React.ComponentType<{
    className?: string
  }>
  plan: string
}

type BaseNavItem = {
  title: string
  badge?: string
  icon?: React.ComponentType<{
    className?: string
  }>
}

type NavLink = BaseNavItem & {
  url: string
  items?: never
}

type NavCollapsible = BaseNavItem & {
  items: (BaseNavItem & { url: string })[]
  url?: never
}

type NavItem = NavCollapsible | NavLink

type NavGroup = {
  title: string
  items: NavItem[]
}

type SidebarData = {
  teams: Team[]
  navGroups: NavGroup[]
}

export type { SidebarData, NavGroup, NavItem, NavCollapsible, NavLink }
