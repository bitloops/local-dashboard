import { describe, expect, it } from 'vitest'
import { mapDashboardResultDataToSessionRows } from './map-dashboard-result-to-session-rows'

describe('mapDashboardResultDataToSessionRows', () => {
  it('returns empty array for non-object data', () => {
    expect(mapDashboardResultDataToSessionRows(null)).toEqual([])
    expect(mapDashboardResultDataToSessionRows(undefined)).toEqual([])
    expect(mapDashboardResultDataToSessionRows('x')).toEqual([])
  })

  it('maps interactionSessions from dashboard data shape', () => {
    const rows = mapDashboardResultDataToSessionRows({
      interactionSessions: [
        {
          sessionId: 's1',
          branch: 'main',
          actor: { name: 'A', email: 'a@x.com' },
          agentType: 'claude-code',
          model: null,
          firstPrompt: 'hi',
          startedAt: '2025-01-01T00:00:00.000Z',
          lastEventAt: null,
          turnCount: 2,
          checkpointCount: 1,
        },
      ],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.session_id).toBe('s1')
    expect(rows[0]?.agent_type).toBe('claude-code')
    expect(rows[0]?.turn_count).toBe(2)
  })
})
