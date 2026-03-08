import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SkipToMain } from './skip-to-main'

describe('SkipToMain', () => {
  it('renders a link with text "Skip to Main"', () => {
    render(<SkipToMain />)
    const link = screen.getByRole('link', { name: 'Skip to Main' })
    expect(link).toBeInTheDocument()
  })

  it('links to #content', () => {
    render(<SkipToMain />)
    const link = screen.getByRole('link', { name: 'Skip to Main' })
    expect(link).toHaveAttribute('href', '#content')
  })
})
