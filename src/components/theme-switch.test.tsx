import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@/context/theme-provider'
import { ThemeSwitch } from './theme-switch'

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}

describe('ThemeSwitch', () => {
  it('renders toggle theme button', () => {
    render(
      <Wrapper>
        <ThemeSwitch />
      </Wrapper>,
    )
    expect(
      screen.getByRole('button', { name: /toggle theme/i }),
    ).toBeInTheDocument()
  })

  it('opens menu with Light, Dark, System when clicked', async () => {
    render(
      <Wrapper>
        <ThemeSwitch />
      </Wrapper>,
    )
    await userEvent.click(screen.getByRole('button', { name: /toggle theme/i }))
    expect(screen.getByRole('menuitem', { name: /light/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /dark/i })).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: /system/i }),
    ).toBeInTheDocument()
  })
})
