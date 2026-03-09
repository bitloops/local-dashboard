import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SidebarProvider } from '@/components/ui/sidebar'
import { TeamSwitcher } from './team-switcher'

function FakeLogo() {
  return <span data-testid="team-logo">Logo</span>
}

const teams = [
  { name: 'Team A', logo: FakeLogo, plan: 'Free' },
  { name: 'Team B', logo: FakeLogo, plan: 'Pro' },
]

function Wrapper({ children }: { children: React.ReactNode }) {
  return <SidebarProvider>{children}</SidebarProvider>
}

describe('TeamSwitcher', () => {
  it('renders first team name and plan by default', () => {
    render(
      <Wrapper>
        <TeamSwitcher teams={teams} />
      </Wrapper>
    )
    expect(screen.getByText('Team A')).toBeInTheDocument()
    expect(screen.getByText('Free')).toBeInTheDocument()
  })

  it('opens dropdown with team options when clicked', async () => {
    render(
      <Wrapper>
        <TeamSwitcher teams={teams} />
      </Wrapper>
    )
    await userEvent.click(screen.getByText('Team A'))
    expect(screen.getByRole('menuitem', { name: /Team A/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Team B/ })).toBeInTheDocument()
  })
})
