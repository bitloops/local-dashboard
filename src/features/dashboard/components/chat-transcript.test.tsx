import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { formatDisplayName, isUserRole, isToolRole } from './chat-utils'
import { ChatTranscript } from './chat-transcript'

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

function msg(
  overrides: Partial<{
    id: string
    timestamp: string
    actor: 'user' | 'assistant'
    variant: 'chat' | 'thinking' | 'tool_use' | 'tool_result'
    text: string
    isError?: boolean
  }> = {},
) {
  return {
    id: 'm1',
    timestamp: '',
    actor: 'user' as const,
    variant: 'chat' as const,
    text: '',
    ...overrides,
  }
}

describe('ChatTranscript', () => {
  const defaultProps = {
    sessionId: 'session-1',
    agentName: 'Agent',
    userName: 'Wayne Omoga OMOGA@GMAIL.COM',
  }

  it('shows empty state message when no entries', () => {
    render(<ChatTranscript entries={[]} {...defaultProps} />)
    expect(
      screen.getByText('No transcript entries available.'),
    ).toBeInTheDocument()
  })

  it('renders one bubble per transcript entry', () => {
    const entries = [
      msg({ id: '1', actor: 'user', variant: 'chat', text: 'User message' }),
      msg({
        id: '2',
        actor: 'assistant',
        variant: 'chat',
        text: 'Agent reply',
      }),
      msg({
        id: '3',
        actor: 'assistant',
        variant: 'tool_result',
        text: 'Tool output',
      }),
    ]
    render(<ChatTranscript entries={entries} {...defaultProps} />)
    expect(screen.getByText('User message')).toBeInTheDocument()
    expect(screen.getByText('Agent reply')).toBeInTheDocument()
    expect(screen.getByText('Tool output')).toBeInTheDocument()
  })

  it('shows user label without email and user bubble styling', () => {
    const entries = [
      msg({ id: '1', actor: 'user', variant: 'chat', text: 'Hi' }),
    ]
    render(<ChatTranscript entries={entries} {...defaultProps} />)
    expect(screen.getByText(/Wayne Omoga/)).toBeInTheDocument()
    const bubble = screen.getByText('Hi').closest('div')
    expect(bubble).toHaveClass('rounded-tr-sm', 'bg-[#15173D]')
  })

  it('shows agent label and agent bubble styling', () => {
    const entries = [
      msg({ id: '1', actor: 'assistant', variant: 'chat', text: 'Hello' }),
    ]
    render(<ChatTranscript entries={entries} {...defaultProps} />)
    expect(screen.getByText('Agent')).toBeInTheDocument()
    const bubble = screen.getByText('Hello').closest('div')
    expect(bubble).toHaveClass('rounded-tl-sm', 'bg-primary')
  })

  it('shows tool_result entries in a code block', () => {
    const entries = [
      msg({
        id: '1',
        actor: 'assistant',
        variant: 'tool_result',
        text: 'Tool result',
      }),
    ]
    render(<ChatTranscript entries={entries} {...defaultProps} />)
    expect(screen.getByText('Tool result')).toBeInTheDocument()
    const codeBlock = screen.getByText('Tool result').closest('.rounded-md')
    expect(codeBlock).toBeInTheDocument()
  })

  it('shows tool_use and tool_result as Call and Response in one code block', () => {
    const entries = [
      msg({
        id: '1',
        actor: 'assistant',
        variant: 'tool_use',
        text: 'Tool: Glob\n{"pattern": "**/*.js"}',
      }),
      msg({
        id: '2',
        actor: 'assistant',
        variant: 'tool_result',
        text: 'src/a.js\nsrc/b.js',
      }),
    ]
    render(<ChatTranscript entries={entries} {...defaultProps} />)
    expect(screen.getByText('Call')).toBeInTheDocument()
    expect(screen.getByText('Response')).toBeInTheDocument()
    expect(screen.getByText(/Glob/)).toBeInTheDocument()
    expect(screen.getByText(/src\/a\.js/)).toBeInTheDocument()
  })

  it('shows thinking with icon and content on one line', () => {
    const entries = [
      msg({
        id: '1',
        actor: 'assistant',
        variant: 'thinking',
        text: 'Thinking: The user is asking about the feature.',
      }),
    ]
    render(<ChatTranscript entries={entries} {...defaultProps} />)
    expect(
      screen.getByText('The user is asking about the feature.'),
    ).toBeInTheDocument()
  })

  it('truncates long content with Show more / Show less', async () => {
    const longContent = 'x'.repeat(301)
    const entries = [
      msg({ id: '1', actor: 'user', variant: 'chat', text: longContent }),
    ]
    render(<ChatTranscript entries={entries} {...defaultProps} />)

    const truncated = 'x'.repeat(300) + '\u2026'
    expect(screen.getByText(truncated)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /show more/i }),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /show more/i }))
    expect(screen.getByText(longContent)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /show less/i }),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /show less/i }))
    expect(screen.getByText(truncated)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /show more/i }),
    ).toBeInTheDocument()
  })
})
