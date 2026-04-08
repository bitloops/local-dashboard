import { isGitBlobOid } from './git-blob-oid'

/** Guards against pathological depth or accidental circular refs in test/mocked data. */
const MAX_WALK_DEPTH = 50

/**
 * True if the GraphQL result payload contains any `blobSha` string field that can
 * be previewed (matches {@link isGitBlobOid}), up to {@link MAX_WALK_DEPTH} levels deep.
 */
export function payloadHasPreviewableBlobSha(
  value: unknown,
  depth = 0,
): boolean {
  if (depth > MAX_WALK_DEPTH) return false
  if (value === null || value === undefined) return false

  if (Array.isArray(value)) {
    return value.some((item) => payloadHasPreviewableBlobSha(item, depth + 1))
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    for (const key of Object.keys(obj)) {
      const v = obj[key]
      if (
        key === 'blobSha' &&
        typeof v === 'string' &&
        v.trim() !== '' &&
        isGitBlobOid(v)
      ) {
        return true
      }
      if (payloadHasPreviewableBlobSha(v, depth + 1)) {
        return true
      }
    }
  }

  return false
}
