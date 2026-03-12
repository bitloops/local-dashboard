import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryEditorPanel } from './query-editor-panel'

describe('QueryEditorPanel', () => {
  it('renders Query Editor heading', () => {
    render(<QueryEditorPanel value='' onChange={() => {}} />)
    expect(screen.getByText('Query Editor')).toBeInTheDocument()
  })

  it('renders textarea with placeholder', () => {
    render(<QueryEditorPanel value='' onChange={() => {}} />)
    expect(
      screen.getByRole('textbox', { name: 'GraphQL query' }),
    ).toHaveAttribute('placeholder', 'Enter your query...')
  })

  it('displays controlled value', () => {
    render(<QueryEditorPanel value='query { id }' onChange={() => {}} />)
    expect(screen.getByRole('textbox', { name: 'GraphQL query' })).toHaveValue(
      'query { id }',
    )
  })

  it('calls onChange when user types', async () => {
    const onChange = vi.fn()
    render(<QueryEditorPanel value='' onChange={onChange} />)
    await userEvent.type(
      screen.getByRole('textbox', { name: 'GraphQL query' }),
      'x',
    )
    expect(onChange).toHaveBeenCalled()
  })
})
