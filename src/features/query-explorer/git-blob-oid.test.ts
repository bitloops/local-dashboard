import { describe, expect, it } from 'vitest'
import { isGitBlobOid } from './git-blob-oid'

describe('isGitBlobOid', () => {
  it('accepts 40 and 64 hex strings', () => {
    const sha1 = 'a'.repeat(40)
    const sha256 = 'b'.repeat(64)
    expect(isGitBlobOid(sha1)).toBe(true)
    expect(isGitBlobOid(sha1.toUpperCase())).toBe(true)
    expect(isGitBlobOid(sha256)).toBe(true)
  })

  it('rejects wrong lengths and non-hex', () => {
    expect(isGitBlobOid('a'.repeat(39))).toBe(false)
    expect(isGitBlobOid('a'.repeat(41))).toBe(false)
    expect(isGitBlobOid('g'.repeat(40))).toBe(false)
  })
})
