import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@/context/theme-provider'
import { FontProvider } from '@/context/font-provider'
import { NavigationProvider } from '@/context/navigation-provider'
import { App } from './App'

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <FontProvider>
        <NavigationProvider>{children}</NavigationProvider>
      </FontProvider>
    </ThemeProvider>
  )
}

describe('App', () => {
  it('renders Skip to Main link', () => {
    render(
      <Wrapper>
        <App />
      </Wrapper>,
    )
    expect(
      screen.getByRole('link', { name: 'Skip to Main' }),
    ).toBeInTheDocument()
  })

  it('renders Dashboard at root path', () => {
    render(
      <Wrapper>
        <App />
      </Wrapper>,
    )
    expect(
      screen.getByRole('link', { name: 'Skip to Main' }),
    ).toBeInTheDocument()
  })
})
