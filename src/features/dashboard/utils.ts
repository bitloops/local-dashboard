import type {
  ApiAgentDto,
  ApiCommitRowDto,
  ApiUserDto,
} from '@/api/types/schema'
import type { CommitData } from './data/mock-commit-data'
import type { UserOption } from './dashboard-view'

export const startOfDayIso = (date: Date): string => {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized.toISOString()
}

export const endOfDayIso = (date: Date): string => {
  const normalized = new Date(date)
  normalized.setHours(23, 59, 59, 999)
  return normalized.toISOString()
}

/** Start of day in Unix seconds (for API from/to params). */
export const startOfDayUnixSeconds = (date: Date): number => {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return Math.floor(normalized.getTime() / 1000)
}

/** End of day in Unix seconds (for API from/to params). */
export const endOfDayUnixSeconds = (date: Date): number => {
  const normalized = new Date(date)
  normalized.setHours(23, 59, 59, 999)
  return Math.floor(normalized.getTime() / 1000)
}

export const formatCommitDate = (
  timestamp: number,
): { label: string; ms: number } => {
  const ts = timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000
  const date = new Date(ts)

  if (Number.isNaN(date.getTime())) {
    return { label: '-', ms: 0 }
  }

  return {
    label: date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
    ms: date.getTime(),
  }
}

export const formatCheckpointTime = (value: string): string => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const mapUserOptions = (users: ApiUserDto[]): UserOption[] => {
  const uniqueUsers = new Map<string, UserOption>()

  for (const user of users) {
    const value = user.key.trim()
    if (!value) {
      continue
    }

    const label = user.name
      ? user.email
        ? `${user.name} (${user.email})`
        : user.name
      : user.email || value

    uniqueUsers.set(value, { label, value })
  }

  return Array.from(uniqueUsers.values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  )
}

/** Format agent key for display; each word capitalised (e.g. "claude-code" → "Claude Code"). */
export function formatAgentLabel(agentKey: string): string {
  return agentKey
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export const mapAgentOptions = (agents: ApiAgentDto[]): string[] =>
  Array.from(
    new Set(
      agents
        .map((agent) => agent.key.trim())
        .filter((agent): agent is string => agent.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b))

export const mapCommitRows = (rows: ApiCommitRowDto[]): CommitData[] => {
  const commits = new Map<string, CommitData & { timestamp: number }>()

  for (const row of rows) {
    const sha = row.commit.sha
    const commitDate = formatCommitDate(row.commit.timestamp)

    const checkpoint = {
      id: row.checkpoint.checkpoint_id,
      firstPromptPreview: row.checkpoint.first_prompt_preview ?? '',
      timestamp: formatCheckpointTime(row.checkpoint.created_at),
      createdAt: row.checkpoint.created_at,
      branch: row.checkpoint.branch,
      agent: row.checkpoint.agent,
      strategy: row.checkpoint.strategy,
      sessionId: row.checkpoint.session_id,
      toolUseId: row.checkpoint.tool_use_id,
      filesTouched:
        row.checkpoint.files_touched.length > 0
          ? row.checkpoint.files_touched
          : (row.commit.files_touched ?? []),
      sessionCount: row.checkpoint.session_count,
      checkpointsCount: row.checkpoint.checkpoints_count,
      isTask: row.checkpoint.is_task,
      commit: row.commit.sha.slice(0, 7),
      commitMessage: row.commit.message,
    }

    const existing = commits.get(sha)
    if (existing) {
      existing.checkpointList.push(checkpoint)
      existing.checkpoints = existing.checkpointList.length
      continue
    }

    commits.set(sha, {
      date: commitDate.label,
      commit: sha.slice(0, 7),
      checkpoints: 1,
      message: row.commit.message,
      author: row.commit.author_name?.trim() ?? '',
      agent: row.checkpoint.agent,
      checkpointList: [checkpoint],
      timestamp: commitDate.ms,
    })
  }

  return Array.from(commits.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .map((commit) => ({
      date: commit.date,
      commit: commit.commit,
      checkpoints: commit.checkpoints,
      message: commit.message,
      author: commit.author,
      agent: commit.agent,
      checkpointList: commit.checkpointList,
    }))
}
