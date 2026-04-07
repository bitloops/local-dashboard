import { describe, expect, it } from 'vitest'
import { parseQueryExplorerRepo } from './parse-query-explorer-repo'

describe('parseQueryExplorerRepo', () => {
  it('returns null for invalid JSON', () => {
    expect(parseQueryExplorerRepo('')).toBeNull()
    expect(parseQueryExplorerRepo('not json')).toBeNull()
  })

  it('returns null when repo missing or empty', () => {
    expect(parseQueryExplorerRepo('{}')).toBeNull()
    expect(parseQueryExplorerRepo('{"repo":""}')).toBeNull()
    expect(parseQueryExplorerRepo('{"repo":"  "}')).toBeNull()
    expect(parseQueryExplorerRepo('{"other":1}')).toBeNull()
  })

  it('returns trimmed repo string', () => {
    expect(parseQueryExplorerRepo('{"repo":"demo"}')).toBe('demo')
    expect(parseQueryExplorerRepo('{"repo":"  acme  "}')).toBe('acme')
  })
})
