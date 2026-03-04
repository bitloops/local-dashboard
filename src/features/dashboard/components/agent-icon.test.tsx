import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentIcon } from './agent-icon'

describe('AgentIcon', () => {
  it('renders img with slug-based src for known agents', () => {
    render(<AgentIcon agent='claude-code' />)
    const img = screen.getByRole('img', { name: 'claude-code' })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', '/images/claude-code.svg')
  })

  it('accepts display name variants for known agents', () => {
    render(<AgentIcon agent='Claude Code' />)
    const img = screen.getByRole('img', { name: 'Claude Code' })
    expect(img).toHaveAttribute('src', '/images/claude-code.svg')
  })

  it('renders fallback icon for unknown agent', () => {
    render(<AgentIcon agent='unknown-agent' />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<AgentIcon agent='claude-code' className='h-6 w-6' />)
    const img = screen.getByRole('img')
    expect(img).toHaveClass('h-6', 'w-6')
  })
})
