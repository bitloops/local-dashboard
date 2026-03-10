import { describe, expect, it } from 'vitest'
import type { ApiCommitRowDto } from '@/api/types/schema'
import {
  endOfDayIso,
  endOfDayUnixSeconds,
  formatAgentLabel,
  formatCheckpointTime,
  formatCommitDate,
  mapAgentOptions,
  mapCommitRows,
  mapUserOptions,
  startOfDayIso,
  startOfDayUnixSeconds,
} from './utils'

describe('formatCheckpointTime', () => {
  it('formats valid ISO timestamp to locale time', () => {
    const result = formatCheckpointTime('2025-03-04T14:30:00.000Z')
    expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)?/i)
  })

  it('returns original value for invalid date string', () => {
    expect(formatCheckpointTime('not-a-date')).toBe('not-a-date')
  })

  it('returns original value for empty string', () => {
    expect(formatCheckpointTime('')).toBe('')
  })
})

describe('formatCommitDate', () => {
  it('returns label and ms for valid timestamp in milliseconds', () => {
    const result = formatCommitDate(1709568000000)
    expect(result.label).toMatch(/\w{3}\s+\d{1,2}/)
    expect(result.ms).toBe(1709568000000)
  })

  it('converts seconds to milliseconds and returns correct ms', () => {
    const result = formatCommitDate(1709568000)
    expect(result.ms).toBe(1709568000000)
    expect(result.label).toMatch(/\w{3}\s+\d{1,2}/)
  })

  it('returns fallback for NaN', () => {
    expect(formatCommitDate(Number.NaN)).toEqual({ label: '-', ms: 0 })
  })

  it('returns fallback for invalid timestamp', () => {
    const result = formatCommitDate(Number.NaN)
    expect(result).toEqual({ label: '-', ms: 0 })
  })
})

describe('startOfDayIso', () => {
  it('returns ISO string with time 00:00:00.000', () => {
    const result = startOfDayIso(new Date('2025-03-04T14:30:00.000Z'))
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00\.000/)
  })
})

describe('endOfDayIso', () => {
  it('returns ISO string with end-of-day time (59:59.999)', () => {
    const result = endOfDayIso(new Date('2025-03-04T14:30:00.000Z'))
    expect(result).toMatch(/T\d{2}:59:59\.999/)
  })
})

describe('startOfDayUnixSeconds', () => {
  it('returns Unix seconds for start of day (00:00:00 local)', () => {
    const result = startOfDayUnixSeconds(new Date('2025-03-04T14:30:00.000Z'))
    expect(Number.isInteger(result)).toBe(true)
    expect(result).toBeGreaterThan(1_700_000_000)
    expect(result).toBeLessThan(2_000_000_000)
    expect(new Date(result * 1000).getUTCHours()).toBeDefined()
  })

  it('is consistent with startOfDayIso when converted back', () => {
    const d = new Date('2025-03-04T14:30:00.000Z')
    const iso = startOfDayIso(d)
    const unix = startOfDayUnixSeconds(d)
    expect(Math.floor(new Date(iso).getTime() / 1000)).toBe(unix)
  })
})

describe('endOfDayUnixSeconds', () => {
  it('returns Unix seconds for end of day (23:59:59 local)', () => {
    const result = endOfDayUnixSeconds(new Date('2025-03-04T14:30:00.000Z'))
    expect(Number.isInteger(result)).toBe(true)
    expect(result).toBeGreaterThan(1_700_000_000)
    expect(result).toBeLessThan(2_000_000_000)
  })

  it('is after startOfDayUnixSeconds for the same date', () => {
    const d = new Date('2025-03-04T14:30:00.000Z')
    expect(endOfDayUnixSeconds(d)).toBeGreaterThan(startOfDayUnixSeconds(d))
  })
})

describe('mapUserOptions', () => {
  it('returns empty array for empty input', () => {
    expect(mapUserOptions([])).toEqual([])
  })

  it('builds label "Name (email)" when both name and email present', () => {
    const result = mapUserOptions([
      { key: 'u1', name: 'Alice', email: 'a@b.com' },
    ])
    expect(result).toEqual([{ value: 'u1', label: 'Alice (a@b.com)' }])
  })

  it('uses name only when email missing', () => {
    const result = mapUserOptions([{ key: 'u1', name: 'Bob', email: '' }])
    expect(result).toEqual([{ value: 'u1', label: 'Bob' }])
  })

  it('uses email as label when name missing', () => {
    const result = mapUserOptions([{ key: 'u1', name: '', email: 'x@y.com' }])
    expect(result).toEqual([{ value: 'u1', label: 'x@y.com' }])
  })

  it('skips users with empty key after trim', () => {
    const result = mapUserOptions([{ key: '  ', name: 'X', email: 'x@x.com' }])
    expect(result).toEqual([])
  })

  it('trims key and dedupes by key', () => {
    const result = mapUserOptions([
      { key: '  u1  ', name: 'Alice', email: 'a@b.com' },
      { key: 'u1', name: 'Alice Again', email: 'a2@b.com' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].value).toBe('u1')
  })

  it('sorts by label', () => {
    const result = mapUserOptions([
      { key: 'b', name: 'Beta', email: 'b@b.com' },
      { key: 'a', name: 'Alpha', email: 'a@a.com' },
    ])
    expect(result.map((o) => o.label)).toEqual([
      'Alpha (a@a.com)',
      'Beta (b@b.com)',
    ])
  })
})

describe('mapAgentOptions', () => {
  it('returns empty array for empty input', () => {
    expect(mapAgentOptions([])).toEqual([])
  })

  it('returns unique sorted keys', () => {
    const result = mapAgentOptions([
      { key: 'agent-b' },
      { key: 'agent-a' },
      { key: 'agent-b' },
    ])
    expect(result).toEqual(['agent-a', 'agent-b'])
  })

  it('trims keys and omits empty', () => {
    const result = mapAgentOptions([
      { key: '  x  ' },
      { key: '' },
      { key: '  ' },
    ])
    expect(result).toEqual(['x'])
  })
})

describe('formatAgentLabel', () => {
  it('capitalises each word', () => {
    expect(formatAgentLabel('claude-code')).toBe('Claude Code')
    expect(formatAgentLabel('gemini-cli')).toBe('Gemini Cli')
    expect(formatAgentLabel('cursor')).toBe('Cursor')
  })
})

function makeCommitRow(
  overrides: Partial<{
    sha: string
    timestamp: number
    message: string
    created_at: string
    checkpoint_id: string
    agent: string
    branch: string
  }>,
): ApiCommitRowDto {
  return {
    commit: {
      sha: overrides.sha ?? 'abc1234567890',
      timestamp: overrides.timestamp ?? 1709568000000,
      message: overrides.message ?? 'test commit',
      author_name: '',
      author_email: '',
      parents: [],
    },
    checkpoint: {
      checkpoint_id: overrides.checkpoint_id ?? 'cp1',
      created_at: overrides.created_at ?? '2025-03-04T12:00:00Z',
      agent: overrides.agent ?? 'claude-code',
      branch: overrides.branch ?? 'main',
      strategy: '',
      tool_use_id: '',
      files_touched: [],
      session_id: '',
      session_count: 0,
      checkpoints_count: 0,
      is_task: false,
    },
  }
}

describe('mapCommitRows', () => {
  it('returns empty array for empty input', () => {
    expect(mapCommitRows([])).toEqual([])
  })

  it('maps one row to CommitData with correct field mapping', () => {
    const rows = [
      makeCommitRow({ sha: 'abc1234567890', message: 'feat: add x' }),
    ]
    const result = mapCommitRows(rows)
    expect(result).toHaveLength(1)
    expect(result[0].commit).toBe('abc1234')
    expect(result[0].message).toBe('feat: add x')
    expect(result[0].date).toMatch(/\w{3}\s+\d{1,2}/)
    expect(result[0].checkpoints).toBe(1)
    expect(result[0].checkpointList).toHaveLength(1)
    expect(result[0].checkpointList[0].id).toBe('cp1')
  })

  it('maps author_name to author', () => {
    const row = makeCommitRow({ sha: 'x123', message: 'msg' })
    const rows = [
      { ...row, commit: { ...row.commit, author_name: 'Jane Doe' } },
    ]
    const result = mapCommitRows(rows)
    expect(result[0].author).toBe('Jane Doe')
  })

  it('dedupes by commit SHA and aggregates checkpoints', () => {
    const rows = [
      makeCommitRow({ sha: 'same123456789', checkpoint_id: 'cp1' }),
      makeCommitRow({ sha: 'same123456789', checkpoint_id: 'cp2' }),
    ]
    const result = mapCommitRows(rows)
    expect(result).toHaveLength(1)
    expect(result[0].checkpoints).toBe(2)
    expect(result[0].checkpointList).toHaveLength(2)
  })

  it('handles invalid timestamp via formatCommitDate fallback', () => {
    const rows = [makeCommitRow({ timestamp: Number.NaN })]
    const result = mapCommitRows(rows)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('-')
  })

  it('sorts by timestamp descending', () => {
    const rows = [
      makeCommitRow({ sha: 'aaa', timestamp: 1000 }),
      makeCommitRow({ sha: 'bbb', timestamp: 2000 }),
    ]
    const result = mapCommitRows(rows)
    expect(result[0].commit).toBe('bbb')
    expect(result[1].commit).toBe('aaa')
  })
})
