import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@/context/theme-provider'
import { FontProvider } from '@/context/font-provider'
import { NavigationProvider } from '@/context/navigation-provider'
import { App } from '@/App'

function renderApp() {
  return render(
    <ThemeProvider>
      <FontProvider>
        <NavigationProvider>
          <App />
        </NavigationProvider>
      </FontProvider>
    </ThemeProvider>
  )
}

describe('App routing integration', () => {
  it('renders Dashboard at root path', () => {
    renderApp()
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('navigates to Settings when Settings link is clicked', async () => {
    renderApp()
    const settingsLink = screen.getByRole('link', { name: /Settings/i })
    await userEvent.click(settingsLink)
    expect(
      screen.getByRole('heading', { name: 'Settings' })
    ).toBeInTheDocument()
    expect(
      screen.getByText('Customize theme and display options.')
    ).toBeInTheDocument()
  })

  it('navigates to Help and shows Coming Soon', async () => {
    renderApp()
    const helpLink = screen.getByRole('link', { name: /Help/i })
    await userEvent.click(helpLink)
    expect(
      screen.getByRole('heading', { name: 'Coming Soon!' })
    ).toBeInTheDocument()
  })

  it('navigates back to Dashboard when Dashboard link is clicked', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('link', { name: /Settings/i }))
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: /Dashboard/i }))
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })
})
