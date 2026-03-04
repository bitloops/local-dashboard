import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@/context/theme-provider'
import { FontProvider } from '@/context/font-provider'
import { AppearanceForm } from './appearance-form'

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <FontProvider>{children}</FontProvider>
    </ThemeProvider>
  )
}

describe('AppearanceForm', () => {
  it('renders Font and Theme sections with submit button', () => {
    render(
      <Wrapper>
        <AppearanceForm />
      </Wrapper>
    )
    expect(screen.getByLabelText(/^Font$/i)).toBeInTheDocument()
    expect(screen.getByText('Theme')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Update preferences' })).toBeInTheDocument()
  })

  it('renders Light and Dark theme options', () => {
    render(
      <Wrapper>
        <AppearanceForm />
      </Wrapper>
    )
    expect(screen.getByText('Light')).toBeInTheDocument()
    expect(screen.getByText('Dark')).toBeInTheDocument()
  })

  it('renders font select with options', () => {
    render(
      <Wrapper>
        <AppearanceForm />
      </Wrapper>
    )
    const select = screen.getByRole('combobox', { name: /font/i })
    expect(select).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Inter' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Manrope' })).toBeInTheDocument()
  })
})
