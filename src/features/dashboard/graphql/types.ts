export type DashboardBranchesQueryData = {
  repo: {
    branches: Array<{
      name: string
      checkpointCount: number
    }>
  } | null
}

export type DashboardRepoOptionsQueryData = {
  repo: {
    users: string[]
    agents: string[]
  } | null
}

export type DashboardCheckpointNode = {
  id: string
  branch: string | null
  agent: string | null
  strategy: string | null
  filesTouched: string[]
  checkpointsCount: number
  sessionCount: number
  sessionId: string
  agents: string[]
  firstPromptPreview: string | null
  createdAt: string | null
  isTask: boolean
  toolUseId: string | null
  tokenUsage: {
    inputTokens: number
    outputTokens: number
    cacheCreationTokens: number
    cacheReadTokens: number
    apiCallCount: number
  } | null
}

export type DashboardCommitEdge = {
  node: {
    sha: string
    parents: string[]
    authorName: string
    authorEmail: string
    commitMessage: string
    committedAt: string
    filesChanged: string[]
    checkpoints: {
      edges: Array<{
        node: DashboardCheckpointNode
      }>
    }
  }
}

export type DashboardCommitsConnection = {
  edges: DashboardCommitEdge[]
  pageInfo?: {
    hasNextPage: boolean
    hasPreviousPage: boolean
    startCursor?: string | null
    endCursor?: string | null
  }
}

/** Result shape for `DASHBOARD_COMMITS_QUERY` only. */
export type DashboardCommitsQueryData = {
  repo: {
    commits: DashboardCommitsConnection
  } | null
}

/** Variables for `DASHBOARD_COMMITS_QUERY` (matches `$commitsFirst: Int!`, etc.). */
export type DashboardCommitsQueryVariables = {
  repo: string
  branch?: string | null
  since?: string | null
  until?: string | null
  /** When set, server filters commits by author (same key as user picker). */
  author?: string | null
  after?: string | null
  before?: string | null
  commitsFirst?: number
  commitsLast?: number
}
