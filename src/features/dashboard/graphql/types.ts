export type DashboardRepositoriesQueryData = {
  repositories: Array<{
    repoId: string
    identity: string
    name: string
    provider: string
    organization: string
    defaultBranch: string | null
  }>
}

export type DashboardBranchesQueryData = {
  branches: Array<{
    branch: string
    checkpointCommits: number
  }>
}

export type DashboardUsersQueryData = {
  users: Array<{
    key: string
    name: string
    email: string
  }>
}

export type DashboardAgentsQueryData = {
  agents: Array<{
    key: string
  }>
}

export type DashboardCommitFileDiffNode = {
  filepath: string
  additionsCount: number
  deletionsCount: number
  changeKind?: string | null
  copiedFromPath?: string | null
  copiedFromBlobSha?: string | null
}

export type DashboardTokenUsageNode = {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  apiCallCount: number
}

export type DashboardCheckpointNode = {
  checkpointId: string
  strategy: string
  branch: string
  checkpointsCount: number
  filesTouched: DashboardCommitFileDiffNode[]
  sessionCount: number
  tokenUsage: DashboardTokenUsageNode | null
  sessionId: string
  agents: string[]
  firstPromptPreview: string
  createdAt: string
  isTask: boolean
  toolUseId: string
}

export type DashboardCommitsQueryData = {
  commits: Array<{
    commit: {
      sha: string
      parents: string[]
      authorName: string
      authorEmail: string
      timestamp: number
      message: string
      filesTouched: DashboardCommitFileDiffNode[]
    }
    checkpoint: DashboardCheckpointNode
    checkpoints: DashboardCheckpointNode[]
  }>
}

export type DashboardCheckpointDetailQueryData = {
  checkpoint: {
    checkpointId: string
    strategy: string
    branch: string
    checkpointsCount: number
    filesTouched: DashboardCommitFileDiffNode[]
    sessionCount: number
    tokenUsage: DashboardTokenUsageNode | null
    sessions: Array<{
      sessionIndex: number
      sessionId: string
      agent: string
      createdAt: string
      isTask: boolean
      toolUseId: string
      metadataJson: string
      transcriptJsonl: string
      promptsText: string
      contextText: string
    }>
  }
}
