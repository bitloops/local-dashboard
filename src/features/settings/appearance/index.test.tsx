import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@/context/theme-provider'
import { FontProvider } from '@/context/font-provider'
import { SettingsAppearance } from './index'

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <FontProvider>{children}</FontProvider>
    </ThemeProvider>
  )
}

describe('SettingsAppearance', () => {
  it('renders Appearance section with title and description', () => {
    render(
      <Wrapper>
        <SettingsAppearance />
      </Wrapper>,
    )
    expect(
      screen.getByRole('heading', { name: 'Appearance' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Customize the appearance of the app/),
    ).toBeInTheDocument()
  })

  it('renders the appearance form', () => {
    render(
      <Wrapper>
        <SettingsAppearance />
      </Wrapper>,
    )
    expect(
      screen.getByRole('button', { name: 'Update preferences' }),
    ).toBeInTheDocument()
  })
})
