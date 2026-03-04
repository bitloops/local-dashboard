import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfirmDialog } from './confirm-dialog'

describe('ConfirmDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: () => {},
    title: 'Confirm action',
    desc: 'Are you sure?',
    handleConfirm: () => {},
  }

  it('shows title and description when open', () => {
    render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByText('Confirm action')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
  })

  it('shows Cancel and Continue buttons by default', () => {
    render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
  })

  it('allows custom confirm and cancel text', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        cancelBtnText='Abort'
        confirmText='Delete'
      />
    )
    expect(screen.getByRole('button', { name: 'Abort' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })
})
