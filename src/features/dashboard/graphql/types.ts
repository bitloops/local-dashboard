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

export type DashboardInteractionActorNode = {
  id?: string | null
  name?: string | null
  email?: string | null
  source?: string | null
}

export type DashboardInteractionTokenUsageNode = {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  apiCallCount: number
}

export type DashboardInteractionToolUseNode = {
  toolInvocationId: string
  toolUseId: string
  sessionId: string
  turnId?: string | null
  toolKind?: string | null
  taskDescription?: string | null
  inputSummary?: string | null
  outputSummary?: string | null
  source?: string | null
  command?: string | null
  commandBinary?: string | null
  commandArgv?: string[] | null
  transcriptPath?: string | null
  startedAt?: string | null
  endedAt?: string | null
}

export type DashboardInteractionCommitAuthorNode = {
  checkpointId: string
  commitSha: string
  name?: string | null
  email?: string | null
  committedAt?: string | null
}

export type DashboardInteractionSessionNode = {
  sessionId: string
  branch?: string | null
  actor?: DashboardInteractionActorNode | null
  agentType: string
  model?: string | null
  firstPrompt?: string | null
  startedAt: string
  endedAt?: string | null
  lastEventAt?: string | null
  turnCount: number
  checkpointCount: number
  tokenUsage?: DashboardInteractionTokenUsageNode | null
  filePaths: string[]
  toolUses: DashboardInteractionToolUseNode[]
  linkedCheckpoints: DashboardInteractionCommitAuthorNode[]
  latestCommitAuthor?: DashboardInteractionCommitAuthorNode | null
}

export type DashboardInteractionUpdateNode = {
  repoId: string
  sessionCount: number
  turnCount: number
  latestSessionId?: string | null
  latestSessionUpdatedAt?: string | null
  latestTurnId?: string | null
  latestTurnUpdatedAt?: string | null
}

export type DashboardInteractionTurnNode = {
  turnId: string
  sessionId: string
  branch?: string | null
  actor?: DashboardInteractionActorNode | null
  turnNumber: number
  prompt?: string | null
  summary?: string | null
  agentType: string
  model?: string | null
  startedAt: string
  endedAt?: string | null
  tokenUsage?: DashboardInteractionTokenUsageNode | null
  filesModified: string[]
  checkpointId?: string | null
  toolUses: DashboardInteractionToolUseNode[]
}

export type DashboardInteractionEventNode = {
  eventId: string
  sessionId: string
  turnId?: string | null
  eventType: string
  eventTime: string
  agentType: string
  model?: string | null
  toolUseId?: string | null
  toolKind?: string | null
  taskDescription?: string | null
  subagentId?: string | null
  payload?: unknown
}

export type DashboardInteractionKpisNode = {
  totalSessions: number
  totalTurns: number
  totalCheckpoints: number
  totalToolUses: number
}

export type DashboardInteractionActorBucketNode = {
  actorEmail: string
  sessionCount: number
  turnCount: number
}

export type DashboardInteractionAgentBucketNode = {
  key: string
  sessionCount: number
  turnCount: number
}

export type DashboardInteractionSessionsQueryData = {
  interactionKpis?: DashboardInteractionKpisNode | null
  interactionActors?: DashboardInteractionActorBucketNode[] | null
  interactionAgents?: DashboardInteractionAgentBucketNode[] | null
  interactionSessions: DashboardInteractionSessionNode[]
}

export type DashboardInteractionSessionDetailQueryData = {
  interactionSession: {
    summary: DashboardInteractionSessionNode
    turns: DashboardInteractionTurnNode[]
    rawEvents: DashboardInteractionEventNode[]
  } | null
}

export type DashboardInteractionUpdatesSubscriptionData = {
  interactionUpdates: DashboardInteractionUpdateNode
}
