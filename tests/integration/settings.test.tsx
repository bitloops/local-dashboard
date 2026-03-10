import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@/context/theme-provider'
import { FontProvider } from '@/context/font-provider'
import { LayoutProvider } from '@/context/layout-provider'
import { NavigationProvider } from '@/context/navigation-provider'
import { SidebarProvider } from '@/components/ui/sidebar'
import { SettingsPage } from '@/features/settings/page'

function renderSettings(ui: React.ReactElement) {
  return render(
    <ThemeProvider>
      <FontProvider>
        <LayoutProvider>
          <NavigationProvider>
            <SidebarProvider>{ui}</SidebarProvider>
          </NavigationProvider>
        </LayoutProvider>
      </FontProvider>
    </ThemeProvider>,
  )
}

describe('Settings integration', () => {
  it('renders Settings shell with title and description', () => {
    renderSettings(<SettingsPage />)
    expect(
      screen.getByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Customize theme and display options.'),
    ).toBeInTheDocument()
  })

  it('renders Appearance section with form', () => {
    renderSettings(<SettingsPage />)
    expect(
      screen.getByRole('heading', { name: 'Appearance' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Update preferences' }),
    ).toBeInTheDocument()
  })

  it('renders sidebar nav with Appearance link', () => {
    renderSettings(<SettingsPage />)
    expect(
      screen.getByRole('link', { name: /Appearance/i }),
    ).toBeInTheDocument()
  })
})
