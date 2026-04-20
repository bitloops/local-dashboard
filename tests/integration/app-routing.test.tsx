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
    </ThemeProvider>,
  )
}

describe('App routing integration', () => {
  it('renders Sessions at root path', () => {
    renderApp()
    expect(
      screen.getByRole('heading', { name: 'Sessions', level: 1 }),
    ).toBeInTheDocument()
  })

  it('navigates to Settings when Settings link is clicked', async () => {
    renderApp()
    const settingsLink = screen.getByRole('link', { name: /Settings/i })
    await userEvent.click(settingsLink)
    expect(
      screen.getByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Customize theme and display options.'),
    ).toBeInTheDocument()
  })

  it('navigates to Help and shows Coming Soon', async () => {
    renderApp()
    const helpLink = screen.getByRole('link', { name: /Help/i })
    await userEvent.click(helpLink)
    expect(
      screen.getByRole('heading', { name: 'Coming Soon!' }),
    ).toBeInTheDocument()
  })

  it('navigates back to Sessions when Sessions link is clicked', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('link', { name: /Settings/i }))
    expect(
      screen.getByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: /Sessions/i }))
    expect(
      screen.getByRole('heading', { name: 'Sessions', level: 1 }),
    ).toBeInTheDocument()
  })

  it('renders Query Explorer link in sidebar', () => {
    renderApp()
    expect(
      screen.getByRole('link', { name: /Query Explorer/i }),
    ).toBeInTheDocument()
  })

  it('navigates to Query Explorer when Query Explorer link is clicked', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('link', { name: /Query Explorer/i }))
    expect(
      screen.getByRole('heading', { name: 'Query Explorer' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Query and explore your code intelligence data.'),
    ).toBeInTheDocument()
  })

  it('navigates back to Sessions from Query Explorer when Sessions link is clicked', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('link', { name: /Query Explorer/i }))
    expect(
      screen.getByRole('heading', { name: 'Query Explorer' }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: /Sessions/i }))
    expect(
      screen.getByRole('heading', { name: 'Sessions', level: 1 }),
    ).toBeInTheDocument()
  })
})
