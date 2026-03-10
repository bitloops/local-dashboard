import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DatePicker } from './date-picker'

describe('DatePicker', () => {
  it('shows placeholder when no date selected', () => {
    const onSelect = () => {}
    render(
      <DatePicker
        selected={undefined}
        onSelect={onSelect}
        placeholder='From date'
      />,
    )
    expect(screen.getByText('From date')).toBeInTheDocument()
  })

  it('shows formatted date when selected', () => {
    const date = new Date(2025, 2, 4) // Mar 4, 2025
    render(<DatePicker selected={date} onSelect={() => {}} />)
    expect(screen.getByText('Mar 4, 2025')).toBeInTheDocument()
  })

  it('opens calendar when trigger is clicked', async () => {
    render(
      <DatePicker
        selected={undefined}
        onSelect={() => {}}
        placeholder='Pick a date'
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /pick a date/i }))
    const calendar = document.querySelector('[role="grid"]')
    expect(calendar).toBeInTheDocument()
  })
})
