import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { JsonHighlight } from './json-highlight'

describe('JsonHighlight', () => {
  it('renders raw value in a pre', () => {
    render(<JsonHighlight value='{"a": 1}' />)
    const pre = document.querySelector('pre')
    expect(pre).toBeInTheDocument()
    expect(pre).toHaveClass(
      'whitespace-pre-wrap',
      'break-words',
      'font-mono',
      'text-xs',
    )
  })

  it('renders JSON keys and values with highlighting', () => {
    render(<JsonHighlight value='{"name": "test"}' />)
    expect(screen.getByText(/"name"/)).toBeInTheDocument()
    expect(screen.getByText(/"test"/)).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <JsonHighlight value='{}' className='custom-class' />,
    )
    const pre = container.querySelector('pre')
    expect(pre).toHaveClass('custom-class')
  })
})
