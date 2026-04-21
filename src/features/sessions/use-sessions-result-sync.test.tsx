import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

const mockSetSessionRows = vi.fn()
const mockSetSessionsPageInfo = vi.fn()
const mockSetCurrentSessionsRequest = vi.fn()

type MockStoreState = {
  result: { status: 'idle' | 'loading' } | { status: 'success'; data: unknown }
  setSessionRows: typeof mockSetSessionRows
  setSessionsPageInfo: typeof mockSetSessionsPageInfo
  setCurrentSessionsRequest: typeof mockSetCurrentSessionsRequest
}

let mockStoreState: MockStoreState

vi.mock('@/store', () => ({
  useStore: <T,>(selector: (state: MockStoreState) => T) =>
    selector(mockStoreState),
}))

import { useSessionsResultSync } from './use-sessions-result-sync'

function SyncProbe({ variables }: { variables: string }) {
  useSessionsResultSync({ variables })
  return null
}

describe('useSessionsResultSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState = {
      result: { status: 'idle' },
      setSessionRows: mockSetSessionRows,
      setSessionsPageInfo: mockSetSessionsPageInfo,
      setCurrentSessionsRequest: mockSetCurrentSessionsRequest,
    }
  })

  it('does nothing when the last result is not successful', () => {
    render(<SyncProbe variables='{"limit":25,"offset":0}' />)

    expect(mockSetSessionRows).not.toHaveBeenCalled()
    expect(mockSetSessionsPageInfo).not.toHaveBeenCalled()
    expect(mockSetCurrentSessionsRequest).not.toHaveBeenCalled()
  })

  it('maps successful dashboard results into rows and pagination metadata', async () => {
    mockStoreState.result = {
      status: 'success',
      data: {
        interactionSessions: [
          {
            sessionId: 'sess-1',
            branch: 'main',
            actor: { name: 'A', email: 'a@example.com' },
            agentType: 'claude-code',
            model: null,
            firstPrompt: 'hello',
            startedAt: '2025-01-01T00:00:00.000Z',
            endedAt: null,
            lastEventAt: null,
            turnCount: 2,
            checkpointCount: 1,
            tokenUsage: null,
            filePaths: [],
            toolUses: [],
            linkedCheckpoints: [],
            latestCommitAuthor: null,
          },
        ],
      },
    }

    render(<SyncProbe variables='{"limit":1,"offset":3}' />)

    expect(mockSetSessionRows).toHaveBeenCalledWith([
      expect.objectContaining({
        session_id: 'sess-1',
        agent_type: 'claude-code',
        turn_count: 2,
      }),
    ])
    expect(mockSetSessionsPageInfo).toHaveBeenCalledWith({
      hasNextPage: true,
      hasPreviousPage: true,
      offset: 3,
    })
    expect(mockSetCurrentSessionsRequest).toHaveBeenCalledWith({ offset: 3 })
  })

  it('uses the row count when limit is zero or invalid', () => {
    mockStoreState.result = {
      status: 'success',
      data: {},
    }

    render(<SyncProbe variables='{"limit":0,"offset":0}' />)

    expect(mockSetSessionRows).toHaveBeenCalledWith([])
    expect(mockSetSessionsPageInfo).toHaveBeenCalledWith({
      hasNextPage: false,
      hasPreviousPage: false,
      offset: 0,
    })
    expect(mockSetCurrentSessionsRequest).toHaveBeenCalledWith({ offset: 0 })
  })
})
