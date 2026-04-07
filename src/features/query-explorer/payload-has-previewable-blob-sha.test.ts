import { describe, expect, it } from 'vitest'
import { payloadHasPreviewableBlobSha } from './payload-has-previewable-blob-sha'

const oid40 = `${'a'.repeat(40)}`

describe('payloadHasPreviewableBlobSha', () => {
  it('returns false for empty / non-object roots', () => {
    expect(payloadHasPreviewableBlobSha(null)).toBe(false)
    expect(payloadHasPreviewableBlobSha(undefined)).toBe(false)
    expect(payloadHasPreviewableBlobSha('x')).toBe(false)
    expect(payloadHasPreviewableBlobSha(1)).toBe(false)
    expect(payloadHasPreviewableBlobSha({})).toBe(false)
  })

  it('detects top-level blobSha', () => {
    expect(payloadHasPreviewableBlobSha({ blobSha: oid40 })).toBe(true)
  })

  it('rejects invalid or non-hex blobSha', () => {
    expect(payloadHasPreviewableBlobSha({ blobSha: 'short' })).toBe(false)
    expect(payloadHasPreviewableBlobSha({ blobSha: `${'z'.repeat(40)}` })).toBe(
      false,
    )
  })

  it('detects nested blobSha (artefacts, file context, etc.)', () => {
    expect(
      payloadHasPreviewableBlobSha({
        repo: {
          ref: {
            file: { blobSha: oid40, path: '/x' },
          },
        },
      }),
    ).toBe(true)
    expect(
      payloadHasPreviewableBlobSha({
        data: {
          artefacts: { edges: [{ node: { path: 'p', blobSha: oid40 } }] },
        },
      }),
    ).toBe(true)
  })

  it('detects blobSha inside arrays', () => {
    expect(payloadHasPreviewableBlobSha([{ blobSha: oid40 }])).toBe(true)
  })

  it('returns false when blobSha is deeper than the walk limit', () => {
    let nested: Record<string, unknown> = { blobSha: oid40 }
    for (let i = 0; i < 60; i += 1) {
      nested = { child: nested }
    }
    expect(payloadHasPreviewableBlobSha(nested)).toBe(false)
  })

  it('does not recurse infinitely on a circular object graph', () => {
    const a: Record<string, unknown> = {}
    a.self = a
    expect(() => payloadHasPreviewableBlobSha(a)).not.toThrow()
    expect(payloadHasPreviewableBlobSha(a)).toBe(false)
  })
})
