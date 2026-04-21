import { DASHBOARD_PAGE_SIZE } from '@/features/dashboard/graphql/fetch-dashboard-data'

export type ParsedSessionsVariables = {
  repoId: string | null
  branch: string | null
  limit: number
  offset: number
}

/** Repo id to scope dashboard requests: valid selection, else first loaded repo (matches Auto). */
export function resolveSessionsRepoId(
  parsedRepoId: string | null,
  repoOptions: Array<{ repoId: string }>,
): string | null {
  if (repoOptions.length === 0) {
    return null
  }
  const trimmed = parsedRepoId?.trim()
  if (trimmed) {
    const found = repoOptions.find((r) => r.repoId === trimmed)
    if (found) {
      return found.repoId
    }
  }
  return repoOptions[0]?.repoId ?? null
}

export function parseSessionsVariablesJson(
  value: string,
): ParsedSessionsVariables {
  try {
    const p = JSON.parse(value) as Record<string, unknown>
    const repoId = typeof p.repoId === 'string' ? p.repoId : null
    const filter =
      typeof p.filter === 'object' &&
      p.filter !== null &&
      !Array.isArray(p.filter)
        ? (p.filter as Record<string, unknown>)
        : {}
    const branch =
      filter.branch === null || filter.branch === undefined
        ? null
        : typeof filter.branch === 'string'
          ? filter.branch
          : null
    const limit =
      typeof p.limit === 'number' && Number.isFinite(p.limit)
        ? p.limit
        : DASHBOARD_PAGE_SIZE
    const offset =
      typeof p.offset === 'number' && Number.isFinite(p.offset) ? p.offset : 0
    return { repoId, branch, limit, offset }
  } catch {
    return {
      repoId: null,
      branch: null,
      limit: DASHBOARD_PAGE_SIZE,
      offset: 0,
    }
  }
}

export function setVariablesRepoId(
  current: string,
  repoId: string | null,
): string {
  try {
    const p = JSON.parse(current) as Record<string, unknown>
    return JSON.stringify({ ...p, repoId }, null, 2)
  } catch {
    return current
  }
}

export function setVariablesBranch(
  current: string,
  branch: string | null,
): string {
  try {
    const p = JSON.parse(current) as Record<string, unknown>
    const prevFilter =
      typeof p.filter === 'object' &&
      p.filter !== null &&
      !Array.isArray(p.filter)
        ? { ...(p.filter as Record<string, unknown>) }
        : {}
    const nextFilter = { ...prevFilter }
    nextFilter.branch = branch?.trim() ? branch.trim() : null
    return JSON.stringify(
      {
        ...p,
        filter: nextFilter,
      },
      null,
      2,
    )
  } catch {
    return current
  }
}

export function setVariablesOffset(current: string, offset: number): string {
  try {
    const p = JSON.parse(current) as Record<string, unknown>
    return JSON.stringify({ ...p, offset }, null, 2)
  } catch {
    return current
  }
}
