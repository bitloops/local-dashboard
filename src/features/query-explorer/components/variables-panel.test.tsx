import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VariablesPanel } from './variables-panel'

describe('VariablesPanel', () => {
  it('renders Variables heading and description', () => {
    render(<VariablesPanel value='{}' onChange={() => {}} />)
    expect(screen.getByText('Variables')).toBeInTheDocument()
    expect(
      screen.getByText('JSON object for query variables'),
    ).toBeInTheDocument()
  })

  it('renders textarea with placeholder', () => {
    render(<VariablesPanel value='' onChange={() => {}} />)
    expect(
      screen.getByRole('textbox', { name: 'Query variables JSON' }),
    ).toHaveAttribute('placeholder', '{}')
  })

  it('displays controlled value', () => {
    render(<VariablesPanel value='{"id": 1}' onChange={() => {}} />)
    expect(
      screen.getByRole('textbox', { name: 'Query variables JSON' }),
    ).toHaveValue('{"id": 1}')
  })

  it('calls onChange when user types', async () => {
    const onChange = vi.fn()
    render(<VariablesPanel value='{}' onChange={onChange} />)
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Query variables JSON' }),
      'x',
    )
    expect(onChange).toHaveBeenCalled()
  })
})
