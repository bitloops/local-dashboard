import { describe, expect, it } from 'vitest'
import { SESSIONS_LANDING_PAGE_SIZE } from '@/features/sessions/sessions-landing-constants'
import {
  parseSessionsVariablesJson,
  resolveSessionsRepoId,
  setVariablesBranch,
  setVariablesOffset,
  setVariablesRepoId,
} from './parse-sessions-variables'

describe('resolveSessionsRepoId', () => {
  const repoOptions = [{ repoId: 'repo-1' }, { repoId: 'repo-2' }]

  it('returns null when no repositories are available', () => {
    expect(resolveSessionsRepoId('repo-1', [])).toBeNull()
  })

  it('returns the trimmed repo id when it exists in the options', () => {
    expect(resolveSessionsRepoId(' repo-2 ', repoOptions)).toBe('repo-2')
  })

  it('falls back to the first repository when repo id is blank or unknown', () => {
    expect(resolveSessionsRepoId('', repoOptions)).toBe('repo-1')
    expect(resolveSessionsRepoId('missing', repoOptions)).toBe('repo-1')
  })
})

describe('parseSessionsVariablesJson', () => {
  it('parses repo, branch, limit, and offset from valid variables JSON', () => {
    expect(
      parseSessionsVariablesJson(`{
        "repoId": "repo-2",
        "limit": 25,
        "offset": 50,
        "filter": {
          "branch": "feature/test"
        }
      }`),
    ).toEqual({
      repoId: 'repo-2',
      branch: 'feature/test',
      limit: 25,
      offset: 50,
    })
  })

  it('falls back to defaults when values are invalid or missing', () => {
    expect(
      parseSessionsVariablesJson(`{
        "repoId": 123,
        "limit": "bad",
        "offset": null,
        "filter": []
      }`),
    ).toEqual({
      repoId: null,
      branch: null,
      limit: SESSIONS_LANDING_PAGE_SIZE,
      offset: 0,
    })
  })

  it('treats null branch as unset and preserves finite numeric values', () => {
    expect(
      parseSessionsVariablesJson(`{
        "repoId": "repo-1",
        "limit": 10,
        "offset": 5,
        "filter": {
          "branch": null
        }
      }`),
    ).toEqual({
      repoId: 'repo-1',
      branch: null,
      limit: 10,
      offset: 5,
    })
  })

  it('returns defaults when JSON parsing fails', () => {
    expect(parseSessionsVariablesJson('not json')).toEqual({
      repoId: null,
      branch: null,
      limit: SESSIONS_LANDING_PAGE_SIZE,
      offset: 0,
    })
  })
})

describe('setVariablesRepoId', () => {
  it('updates repoId in the variables JSON', () => {
    expect(setVariablesRepoId('{"offset":0}', 'repo-1')).toBe(`{
  "offset": 0,
  "repoId": "repo-1"
}`)
  })

  it('returns the original value when the JSON is invalid', () => {
    expect(setVariablesRepoId('bad json', 'repo-1')).toBe('bad json')
  })
})

describe('setVariablesBranch', () => {
  it('creates a filter object when needed and trims the branch value', () => {
    expect(setVariablesBranch('{"repoId":"repo-1"}', ' main ')).toBe(`{
  "repoId": "repo-1",
  "filter": {
    "branch": "main"
  }
}`)
  })

  it('replaces a non-object filter and clears blank branch values', () => {
    expect(setVariablesBranch('{"filter":[]}', '   ')).toBe(`{
  "filter": {
    "branch": null
  }
}`)
  })

  it('returns the original value when the JSON is invalid', () => {
    expect(setVariablesBranch('bad json', 'main')).toBe('bad json')
  })
})

describe('setVariablesOffset', () => {
  it('updates offset in the variables JSON', () => {
    expect(setVariablesOffset('{"limit":25}', 75)).toBe(`{
  "limit": 25,
  "offset": 75
}`)
  })

  it('returns the original value when the JSON is invalid', () => {
    expect(setVariablesOffset('bad json', 75)).toBe('bad json')
  })
})
