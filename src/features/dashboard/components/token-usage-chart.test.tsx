import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TokenUsageChart } from './token-usage-chart'

describe('TokenUsageChart', () => {
  it('shows "total tokens" and placeholder when usage is null', () => {
    render(<TokenUsageChart usage={null} />)
    expect(screen.getByText('total tokens')).toBeInTheDocument()
    expect(screen.getByRole('application')).toBeInTheDocument()
  })

  it('shows total and segment labels when usage is provided', () => {
    const usage = {
      input_tokens: 100,
      output_tokens: 50,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      api_call_count: 2,
    }
    render(<TokenUsageChart usage={usage} />)
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('total tokens')).toBeInTheDocument()
    expect(screen.getByText('Input')).toBeInTheDocument()
    expect(screen.getByText('Output')).toBeInTheDocument()
  })
})
