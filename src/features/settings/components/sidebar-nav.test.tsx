import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NavigationProvider } from '@/context/navigation-provider'
import { SidebarNav } from './sidebar-nav'

const items = [
  {
    href: '/settings',
    title: 'General',
    icon: <span data-testid='icon-general' />,
  },
  {
    href: '/settings/appearance',
    title: 'Appearance',
    icon: <span data-testid='icon-appearance' />,
  },
]

function Wrapper({ children }: { children: React.ReactNode }) {
  return <NavigationProvider>{children}</NavigationProvider>
}

describe('SidebarNav', () => {
  it('renders nav with links for each item', () => {
    render(
      <Wrapper>
        <SidebarNav items={items} />
      </Wrapper>,
    )
    expect(screen.getByRole('link', { name: /General/i })).toHaveAttribute(
      'href',
      '/settings',
    )
    expect(screen.getByRole('link', { name: /Appearance/i })).toHaveAttribute(
      'href',
      '/settings/appearance',
    )
  })

  it('renders mobile select trigger for small viewport', () => {
    render(
      <Wrapper>
        <SidebarNav items={items} />
      </Wrapper>,
    )
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})
