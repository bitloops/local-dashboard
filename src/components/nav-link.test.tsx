import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NavigationProvider } from '@/context/navigation-provider'
import { NavLink } from './nav-link'

function Wrapper({ children }: { children: React.ReactNode }) {
  return <NavigationProvider>{children}</NavigationProvider>
}

describe('NavLink', () => {
  it('renders link with href and children', () => {
    render(
      <Wrapper>
        <NavLink to='/dashboard'>Dashboard</NavLink>
      </Wrapper>,
    )
    const link = screen.getByRole('link', { name: 'Dashboard' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/dashboard')
  })

  it('calls navigate and onClick when clicked', async () => {
    const onClick = vi.fn()
    render(
      <Wrapper>
        <NavLink to='/settings' onClick={onClick}>
          Settings
        </NavLink>
      </Wrapper>,
    )
    const link = screen.getByRole('link', { name: 'Settings' })
    await userEvent.click(link)
    expect(onClick).toHaveBeenCalled()
  })
})
