import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ChatTranscript,
  formatDisplayName,
  isUserRole,
  isToolRole,
} from './chat-transcript'

describe('formatDisplayName', () => {
  it('strips email from "Name EMAIL" API format', () => {
    expect(formatDisplayName('Wayne Omoga OMOGA@GMAIL.COM')).toBe('Wayne Omoga')
    expect(formatDisplayName('Wayne Omoga omoga@gmail.com')).toBe('Wayne Omoga')
  })

  it('returns name only when no email', () => {
    expect(formatDisplayName('Name Only')).toBe('Name Only')
  })

  it('returns original when only email (fallback)', () => {
    expect(formatDisplayName('user@example.com')).toBe('user@example.com')
  })

  it('handles empty string', () => {
    expect(formatDisplayName('')).toBe('')
  })

  it('trims and removes token containing @', () => {
    expect(formatDisplayName('  A  B  C@X.COM  ')).toBe('A B')
  })
})

describe('isUserRole', () => {
  it('returns true for "user" and "human"', () => {
    expect(isUserRole('user')).toBe(true)
    expect(isUserRole('human')).toBe(true)
  })

  it('returns false for other roles', () => {
    expect(isUserRole('assistant')).toBe(false)
    expect(isUserRole('tool')).toBe(false)
    expect(isUserRole('')).toBe(false)
    expect(isUserRole('agent')).toBe(false)
  })
})

describe('isToolRole', () => {
  it('returns true for tool, system, and tool_* roles', () => {
    expect(isToolRole('tool')).toBe(true)
    expect(isToolRole('system')).toBe(true)
    expect(isToolRole('tool_foo')).toBe(true)
  })

  it('returns false for user and assistant', () => {
    expect(isToolRole('user')).toBe(false)
    expect(isToolRole('assistant')).toBe(false)
  })
})

describe('ChatTranscript', () => {
  const defaultProps = {
    sessionId: 'session-1',
    agentName: 'Agent',
    userName: 'Wayne Omoga OMOGA@GMAIL.COM',
  }

  it('shows empty state message when no entries', () => {
    render(<ChatTranscript entries={[]} {...defaultProps} />)
    expect(screen.getByText('No transcript entries available.')).toBeInTheDocument()
  })

  it('renders one bubble per transcript entry', () => {
    const entries = [
      { role: 'user', content: 'User message' },
      { role: 'assistant', content: 'Agent reply' },
      { role: 'tool', content: 'Tool output' },
    ]
    render(<ChatTranscript entries={entries} {...defaultProps} />)
    expect(screen.getByText('User message')).toBeInTheDocument()
    expect(screen.getByText('Agent reply')).toBeInTheDocument()
    expect(screen.getByText('Tool output')).toBeInTheDocument()
  })

  it('shows user label without email and user bubble styling', () => {
    const entries = [{ role: 'user', content: 'Hi' }]
    render(<ChatTranscript entries={entries} {...defaultProps} />)
    expect(screen.getByText(/Wayne Omoga/)).toBeInTheDocument()
    const bubble = screen.getByText('Hi').closest('div')
    expect(bubble).toHaveClass('rounded-tr-sm', 'bg-primary/15')
  })

  it('shows agent label and agent bubble styling', () => {
    const entries = [{ role: 'assistant', content: 'Hello' }]
    render(<ChatTranscript entries={entries} {...defaultProps} />)
    expect(screen.getByText('Agent')).toBeInTheDocument()
    const bubble = screen.getByText('Hello').closest('div')
    expect(bubble).toHaveClass('rounded-tl-sm', 'bg-muted/60')
  })

  it('shows tool entries with dashed style', () => {
    const entries = [{ role: 'tool', content: 'Tool result' }]
    render(<ChatTranscript entries={entries} {...defaultProps} />)
    const toolBlock = screen.getByText('Tool result').closest('div')
    expect(toolBlock).toHaveClass('border-dashed')
  })

  it('truncates long content with Show more / Show less', async () => {
    const longContent = 'x'.repeat(301)
    const entries = [{ role: 'user', content: longContent }]
    render(<ChatTranscript entries={entries} {...defaultProps} />)

    const truncated = 'x'.repeat(300) + '\u2026'
    expect(screen.getByText(truncated)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /show more/i }))
    expect(screen.getByText(longContent)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /show less/i }))
    expect(screen.getByText(truncated)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument()
  })
})
