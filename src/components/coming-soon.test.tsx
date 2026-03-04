import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComingSoon } from './coming-soon'

describe('ComingSoon', () => {
  it('renders "Coming Soon!" heading', () => {
    render(<ComingSoon />)
    expect(screen.getByRole('heading', { level: 1, name: 'Coming Soon!' })).toBeInTheDocument()
  })

  it('renders placeholder message', () => {
    render(<ComingSoon />)
    expect(screen.getByText(/This page has not been created yet/)).toBeInTheDocument()
    expect(screen.getByText(/Stay tuned though/)).toBeInTheDocument()
  })
})
