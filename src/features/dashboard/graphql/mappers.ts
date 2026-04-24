import type {
  DashboardAgentDto,
  DashboardBranchSummaryDto,
  DashboardCheckpointDetailResponse,
  DashboardCheckpointDto,
  DashboardCommitFileDiffDto,
  DashboardCommitRowDto,
  DashboardInteractionActorDto,
  DashboardInteractionEventDto,
  DashboardInteractionSessionDetailResponse,
  DashboardInteractionSessionDto,
  DashboardInteractionToolUseDto,
  DashboardInteractionTurnDto,
  DashboardInteractionUpdateDto,
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
  DashboardInteractionActorNode,
  DashboardInteractionEventNode,
  DashboardInteractionSessionDetailQueryData,
  DashboardInteractionSessionNode,
  DashboardInteractionTokenUsageNode,
  DashboardInteractionToolUseNode,
  DashboardInteractionTurnNode,
  DashboardInteractionUpdateNode,
  DashboardRepositoriesQueryData,
  DashboardInteractionSessionsQueryData,
  DashboardTokenUsageNode,
  DashboardUsersQueryData,
} from './types'

function mapFileDiff(
  node: DashboardCommitFileDiffNode,
): DashboardCommitFileDiffDto {
  return {
    filepath: node.filepath,
    additionsCount: node.additionsCount,
    deletionsCount: node.deletionsCount,
    changeKind: node.changeKind ?? null,
    copiedFromPath: node.copiedFromPath ?? null,
    copiedFromBlobSha: node.copiedFromBlobSha ?? null,
  }
}

type AnyTokenUsageNode =
  | DashboardTokenUsageNode
  | DashboardInteractionTokenUsageNode

function mapTokenUsage(
  node: AnyTokenUsageNode | null | undefined,
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

function mapInteractionActor(
  node: DashboardInteractionActorNode | null | undefined,
): DashboardInteractionActorDto | null {
  if (node == null) return null
  const hasAny =
    node.id != null ||
    node.name != null ||
    node.email != null ||
    node.source != null
  if (!hasAny) return null
  return {
    id: node.id ?? null,
    name: node.name ?? null,
    email: node.email ?? null,
    source: node.source ?? null,
  }
}

function mapInteractionToolUse(
  node: DashboardInteractionToolUseNode,
): DashboardInteractionToolUseDto {
  return {
    tool_invocation_id: node.toolInvocationId ?? '',
    tool_use_id: node.toolUseId,
    session_id: node.sessionId,
    turn_id: node.turnId ?? null,
    tool_kind: node.toolKind ?? null,
    task_description: node.taskDescription ?? null,
    input_summary: node.inputSummary ?? null,
    output_summary: node.outputSummary ?? null,
    source: node.source ?? null,
    command: node.command ?? null,
    command_binary: node.commandBinary ?? null,
    command_argv: node.commandArgv ?? [],
    transcript_path: node.transcriptPath ?? null,
    started_at: node.startedAt ?? null,
    ended_at: node.endedAt ?? null,
  }
}

function mapInteractionSession(
  node: DashboardInteractionSessionNode,
): DashboardInteractionSessionDto {
  return {
    session_id: node.sessionId,
    branch: node.branch ?? null,
    actor: mapInteractionActor(node.actor),
    agent_type: node.agentType,
    model: node.model ?? null,
    first_prompt: node.firstPrompt ?? null,
    started_at: node.startedAt,
    ended_at: node.endedAt ?? null,
    last_event_at: node.lastEventAt ?? null,
    turn_count: node.turnCount,
    checkpoint_count: node.checkpointCount,
    token_usage: mapTokenUsage(node.tokenUsage),
    file_paths: node.filePaths ?? [],
    tool_uses: (node.toolUses ?? []).map(mapInteractionToolUse),
    linked_checkpoints: (node.linkedCheckpoints ?? []).map((c) => ({
      checkpoint_id: c.checkpointId,
      commit_sha: c.commitSha,
      name: c.name ?? null,
      email: c.email ?? null,
      committed_at: c.committedAt ?? null,
    })),
    latest_commit_author: node.latestCommitAuthor
      ? {
          checkpoint_id: node.latestCommitAuthor.checkpointId,
          commit_sha: node.latestCommitAuthor.commitSha,
          name: node.latestCommitAuthor.name ?? null,
          email: node.latestCommitAuthor.email ?? null,
          committed_at: node.latestCommitAuthor.committedAt ?? null,
        }
      : null,
  }
}

function mapInteractionTurn(
  node: DashboardInteractionTurnNode,
): DashboardInteractionTurnDto {
  return {
    turn_id: node.turnId,
    session_id: node.sessionId,
    branch: node.branch ?? null,
    actor: mapInteractionActor(node.actor),
    turn_number: node.turnNumber,
    prompt: node.prompt ?? null,
    summary: node.summary ?? null,
    agent_type: node.agentType,
    model: node.model ?? null,
    started_at: node.startedAt,
    ended_at: node.endedAt ?? null,
    token_usage: mapTokenUsage(node.tokenUsage),
    files_modified: node.filesModified ?? [],
    checkpoint_id: node.checkpointId ?? null,
    tool_uses: (node.toolUses ?? []).map(mapInteractionToolUse),
  }
}

function mapInteractionEvent(
  node: DashboardInteractionEventNode,
): DashboardInteractionEventDto {
  return {
    event_id: node.eventId,
    session_id: node.sessionId,
    turn_id: node.turnId ?? null,
    event_type: node.eventType,
    event_time: node.eventTime,
    agent_type: node.agentType,
    model: node.model ?? null,
    tool_use_id: node.toolUseId ?? null,
    tool_kind: node.toolKind ?? null,
    task_description: node.taskDescription ?? null,
    subagent_id: node.subagentId ?? null,
    payload: node.payload ?? null,
  }
}

export function mapDashboardInteractionUpdate(
  node: DashboardInteractionUpdateNode,
): DashboardInteractionUpdateDto {
  return {
    repo_id: node.repoId,
    session_count: node.sessionCount,
    turn_count: node.turnCount,
    latest_session_id: node.latestSessionId ?? null,
    latest_session_updated_at: node.latestSessionUpdatedAt ?? null,
    latest_turn_id: node.latestTurnId ?? null,
    latest_turn_updated_at: node.latestTurnUpdatedAt ?? null,
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

/** Newest `started_at` first; `session_id` is a stable tie-breaker. */
function compareDashboardSessionsByStartTime(
  a: DashboardInteractionSessionDto,
  b: DashboardInteractionSessionDto,
): number {
  const t = b.started_at.localeCompare(a.started_at)
  if (t !== 0) return t
  return a.session_id.localeCompare(b.session_id)
}

export function mapDashboardInteractionSessions(
  data: DashboardInteractionSessionsQueryData,
): DashboardInteractionSessionDto[] {
  const rows = (data.interactionSessions ?? []).map(mapInteractionSession)
  rows.sort(compareDashboardSessionsByStartTime)
  return rows
}

export function mapDashboardInteractionSessionDetail(
  data: DashboardInteractionSessionDetailQueryData,
): DashboardInteractionSessionDetailResponse | null {
  const session = data.interactionSession
  if (session == null) return null

  return {
    summary: mapInteractionSession(session.summary),
    turns: (session.turns ?? []).map(mapInteractionTurn),
    raw_events: (session.rawEvents ?? []).map(mapInteractionEvent),
  }
}
