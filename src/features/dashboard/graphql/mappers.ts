import type {
  ApiAgentDto,
  ApiBranchSummaryDto,
  ApiCommitRowDto,
  ApiCommitFileDiffDto,
  ApiUserDto,
} from '@/api/rest'
import type {
  DashboardBranchesQueryData,
  DashboardCommitsQueryData,
} from './types'

function canonicalUserKey(name: string, email: string): string {
  const emailNormalized = email.trim().toLowerCase()
  if (emailNormalized.length > 0) {
    return emailNormalized
  }
  const nameNormalized = name.trim().toLowerCase()
  if (nameNormalized.length === 0) {
    return ''
  }
  return `name:${nameNormalized}`
}

export function canonicalAgentKey(agent: string): string {
  const trimmed = agent.trim()
  if (!trimmed) return ''

  let key = ''
  let lastWasDash = false
  for (const ch of trimmed) {
    if (/[a-z0-9]/i.test(ch)) {
      key += ch.toLowerCase()
      lastWasDash = false
      continue
    }
    if (key && !lastWasDash) {
      key += '-'
      lastWasDash = true
    }
  }

  return key.replace(/-+$/g, '')
}

function toUnixTimestamp(value: string): number {
  const ms = new Date(value).getTime()
  if (Number.isNaN(ms)) return 0
  return Math.floor(ms / 1000)
}

function toFileStats(paths: string[]): ApiCommitFileDiffDto[] {
  return paths.map((filepath) => ({
    filepath,
    additionsCount: 0,
    deletionsCount: 0,
  }))
}

function checkpointAgentKeys(checkpoint: {
  agents: string[]
  agent: string | null
}): string[] {
  return Array.from(
    new Set(
      (checkpoint.agents.length > 0
        ? checkpoint.agents
        : [checkpoint.agent ?? '']
      )
        .map(canonicalAgentKey)
        .filter((value) => value.length > 0),
    ),
  )
}

export function mapDashboardBranches(
  data: DashboardBranchesQueryData,
): ApiBranchSummaryDto[] {
  return (data.repo?.branches ?? []).map((branch) => ({
    branch: branch.name,
    checkpoint_commits: branch.checkpointCount,
  }))
}

/** Map `repo.users` string keys to DTOs for filter dropdowns. */
export function mapRepoUserStrings(keys: string[]): ApiUserDto[] {
  const out: ApiUserDto[] = []
  const seen = new Set<string>()
  for (const raw of keys) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const looksLikeEmail = trimmed.includes('@')
    const key = canonicalUserKey(trimmed, looksLikeEmail ? trimmed : '')
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      key,
      name: looksLikeEmail ? '' : trimmed,
      email: looksLikeEmail ? trimmed.toLowerCase() : '',
    })
  }
  return out
}

/** Map `repo.agents` string keys to DTOs for filter dropdowns. */
export function mapRepoAgentStrings(keys: string[]): ApiAgentDto[] {
  const out: ApiAgentDto[] = []
  const seen = new Set<string>()
  for (const raw of keys) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const key = canonicalAgentKey(trimmed) || trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ key })
  }
  return out
}

export function mapDashboardCommitRows(
  data: DashboardCommitsQueryData,
  filters: {
    user: string | null
    agent: string | null
    /** When true, `commits` were already filtered by author on the server — skip client user skip. */
    userFilterFromServer?: boolean
  },
): ApiCommitRowDto[] {
  const commits = data.repo?.commits.edges ?? []
  const commitRows: ApiCommitRowDto[] = []

  for (const edge of commits) {
    const commit = edge.node
    const userKey = canonicalUserKey(commit.authorName, commit.authorEmail)

    if (
      !filters.userFilterFromServer &&
      filters.user &&
      filters.user !== userKey
    ) {
      continue
    }

    const checkpoints = commit.checkpoints.edges
    for (const checkpointEdge of checkpoints) {
      const checkpoint = checkpointEdge.node
      const checkpointAgents = checkpointAgentKeys(checkpoint)

      if (
        filters.agent &&
        !checkpointAgents.some((agent) => agent === filters.agent)
      ) {
        continue
      }

      commitRows.push({
        commit: {
          sha: commit.sha,
          parents: commit.parents,
          author_name: commit.authorName,
          author_email: commit.authorEmail.trim().toLowerCase(),
          message: commit.commitMessage,
          timestamp: toUnixTimestamp(commit.committedAt),
          files_touched: toFileStats(commit.filesChanged),
        },
        checkpoint: {
          checkpoint_id: checkpoint.id,
          strategy: checkpoint.strategy ?? '',
          branch: checkpoint.branch ?? '',
          checkpoints_count: checkpoint.checkpointsCount,
          files_touched: toFileStats(checkpoint.filesTouched),
          session_count: checkpoint.sessionCount,
          token_usage: checkpoint.tokenUsage
            ? {
                input_tokens: checkpoint.tokenUsage.inputTokens,
                output_tokens: checkpoint.tokenUsage.outputTokens,
                cache_creation_tokens:
                  checkpoint.tokenUsage.cacheCreationTokens,
                cache_read_tokens: checkpoint.tokenUsage.cacheReadTokens,
                api_call_count: checkpoint.tokenUsage.apiCallCount,
              }
            : null,
          session_id: checkpoint.sessionId,
          agents: checkpointAgents,
          first_prompt_preview: checkpoint.firstPromptPreview ?? '',
          created_at: checkpoint.createdAt ?? '',
          is_task: checkpoint.isTask,
          tool_use_id: checkpoint.toolUseId ?? '',
        },
      })
    }
  }

  return commitRows
}
