export class GitBlobFetchError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'GitBlobFetchError'
    this.status = status
    this.code = code
  }
}

export type FetchGitBlobParams = {
  repo: string
  blobSha: string
  signal?: AbortSignal
}

/**
 * Fetches raw git blob bytes from the dashboard REST API (same origin as the bundle).
 */
export async function fetchGitBlob({
  repo,
  blobSha,
  signal,
}: FetchGitBlobParams): Promise<ArrayBuffer> {
  const url = `/api/blobs/${encodeURIComponent(repo)}/${encodeURIComponent(blobSha)}`
  const response = await fetch(url, { method: 'GET', signal })

  if (response.ok) {
    return response.arrayBuffer()
  }

  let message = `Request failed (${response.status}).`
  let code: string | undefined
  try {
    const payload = (await response.json()) as {
      error?: { code?: string; message?: string }
    }
    if (payload?.error?.message) {
      message = payload.error.message
    }
    if (payload?.error?.code) {
      code = payload.error.code
    }
  } catch {
    // ignore JSON parse errors
  }

  throw new GitBlobFetchError(message, response.status, code)
}
