import type {
  DashboardAgentDto,
  DashboardBranchSummaryDto,
  DashboardCheckpointDetailResponse,
  DashboardCheckpointDto,
  DashboardCommitFileDiffDto,
  DashboardCommitRowDto,
  DashboardRepositoryOption,
  DashboardTokenUsageDto,
  DashboardUserDto,
} from '../api-types'
import type {
  DashboardAgentsQueryData,
  DashboardBranchesQueryData,
  DashboardCheckpointDetailQueryData,
  DashboardCheckpointNode,
  DashboardCommitFileDiffNode,
  DashboardCommitsQueryData,
  DashboardRepositoriesQueryData,
  DashboardTokenUsageNode,
  DashboardUsersQueryData,
} from './types'

function mapFileDiff(node: DashboardCommitFileDiffNode): DashboardCommitFileDiffDto {
  return {
    filepath: node.filepath,
    additionsCount: node.additionsCount,
    deletionsCount: node.deletionsCount,
    changeKind: node.changeKind ?? null,
    copiedFromPath: node.copiedFromPath ?? null,
    copiedFromBlobSha: node.copiedFromBlobSha ?? null,
  }
}

function mapTokenUsage(
  node: DashboardTokenUsageNode | null | undefined,
): DashboardTokenUsageDto | null {
  if (node == null) {
    return null
  }

  return {
    input_tokens: node.inputTokens,
    output_tokens: node.outputTokens,
    cache_creation_tokens: node.cacheCreationTokens,
    cache_read_tokens: node.cacheReadTokens,
    api_call_count: node.apiCallCount,
  }
}

function mapCheckpoint(node: DashboardCheckpointNode): DashboardCheckpointDto {
  return {
    checkpoint_id: node.checkpointId,
    strategy: node.strategy,
    branch: node.branch,
    checkpoints_count: node.checkpointsCount,
    files_touched: node.filesTouched.map(mapFileDiff),
    session_count: node.sessionCount,
    token_usage: mapTokenUsage(node.tokenUsage),
    session_id: node.sessionId,
    agents: node.agents,
    first_prompt_preview: node.firstPromptPreview,
    created_at: node.createdAt,
    is_task: node.isTask,
    tool_use_id: node.toolUseId,
  }
}

export function mapDashboardRepositories(
  data: DashboardRepositoriesQueryData,
): DashboardRepositoryOption[] {
  return data.repositories.map((repository) => ({
    repoId: repository.repoId,
    identity: repository.identity,
    name: repository.name,
    provider: repository.provider,
    organization: repository.organization,
    defaultBranch: repository.defaultBranch ?? null,
  }))
}

export function mapDashboardBranches(
  data: DashboardBranchesQueryData,
): DashboardBranchSummaryDto[] {
  return data.branches.map((branch) => ({
    branch: branch.branch,
    checkpoint_commits: branch.checkpointCommits,
  }))
}

export function mapDashboardUsers(
  data: DashboardUsersQueryData,
): DashboardUserDto[] {
  return data.users.map((user) => ({
    key: user.key,
    name: user.name,
    email: user.email,
  }))
}

export function mapDashboardAgents(
  data: DashboardAgentsQueryData,
): DashboardAgentDto[] {
  return data.agents.map((agent) => ({
    key: agent.key,
  }))
}

export function mapDashboardCommitRows(
  data: DashboardCommitsQueryData,
): DashboardCommitRowDto[] {
  return data.commits.map((row) => {
    const checkpoints =
      row.checkpoints.length > 0
        ? row.checkpoints.map(mapCheckpoint)
        : [mapCheckpoint(row.checkpoint)]
    const firstCheckpoint = checkpoints[0]

    return {
      commit: {
        sha: row.commit.sha,
        parents: row.commit.parents,
        author_name: row.commit.authorName,
        author_email: row.commit.authorEmail,
        timestamp: row.commit.timestamp,
        message: row.commit.message,
        files_touched: row.commit.filesTouched.map(mapFileDiff),
      },
      checkpoint: firstCheckpoint,
      checkpoints,
    }
  })
}

export function mapDashboardCheckpointDetail(
  data: DashboardCheckpointDetailQueryData,
): DashboardCheckpointDetailResponse {
  return {
    checkpoint_id: data.checkpoint.checkpointId,
    strategy: data.checkpoint.strategy,
    branch: data.checkpoint.branch,
    checkpoints_count: data.checkpoint.checkpointsCount,
    files_touched: data.checkpoint.filesTouched.map(mapFileDiff),
    session_count: data.checkpoint.sessionCount,
    token_usage: mapTokenUsage(data.checkpoint.tokenUsage),
    sessions: data.checkpoint.sessions.map((session) => ({
      session_index: session.sessionIndex,
      session_id: session.sessionId,
      agent: session.agent,
      created_at: session.createdAt,
      is_task: session.isTask,
      tool_use_id: session.toolUseId,
      metadata_json: session.metadataJson,
      transcript_jsonl: session.transcriptJsonl,
      prompts_text: session.promptsText,
      context_text: session.contextText,
    })),
  }
}
