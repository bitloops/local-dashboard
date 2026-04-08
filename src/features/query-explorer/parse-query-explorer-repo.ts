/**
 * Reads the `repo` variable used by Query Explorer GraphQL queries (`repo(name: $repo)`).
 */
export function parseQueryExplorerRepo(variables: string): string | null {
  try {
    const parsed = JSON.parse(variables) as unknown
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null
    }
    const repo = (parsed as Record<string, unknown>).repo
    if (typeof repo !== 'string') return null
    const trimmed = repo.trim()
    return trimmed.length > 0 ? trimmed : null
  } catch {
    return null
  }
}
