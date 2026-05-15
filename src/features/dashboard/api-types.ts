export type DashboardRepositoryOption = {
  repoId: string
  identity: string
  name: string
  provider: string
  organization: string
  defaultBranch: string | null
}

export type DashboardAgentDto = {
  key: string
}

export type DashboardUserDto = {
  key: string
  name: string
  email: string
}

export type DashboardBranchSummaryDto = {
  branch: string
  checkpoint_commits: number
}

export type DashboardTokenUsageDto = {
  input_tokens: number
  output_tokens: number
  cache_creation_tokens: number
  cache_read_tokens: number
  api_call_count: number
}

export type DashboardTranscriptActorDto = 'USER' | 'ASSISTANT' | 'SYSTEM'

export type DashboardTranscriptVariantDto =
  | 'CHAT'
  | 'THINKING'
  | 'TOOL_USE'
  | 'TOOL_RESULT'

export type DashboardTranscriptSourceDto = 'TRANSCRIPT' | 'PROMPT_FALLBACK'

export type DashboardTranscriptEntryDto = {
  entry_id: string
  session_id: string
  turn_id: string | null
  order: number
  timestamp: string | null
  actor: DashboardTranscriptActorDto
  variant: DashboardTranscriptVariantDto
  source: DashboardTranscriptSourceDto
  text: string
  tool_use_id: string | null
  tool_kind: string | null
  is_error: boolean
}

export type DashboardCommitFileDiffDto = {
  filepath: string
  additionsCount: number
  deletionsCount: number
  changeKind?: string | null
  copiedFromPath?: string | null
  copiedFromBlobSha?: string | null
}

export type DashboardCheckpointDto = {
  checkpoint_id: string
  strategy: string
  branch: string
  checkpoints_count: number
  files_touched: DashboardCommitFileDiffDto[]
  session_count: number
  token_usage: DashboardTokenUsageDto | null
  session_id: string
  agents: string[]
  first_prompt_preview: string
  created_at: string
  is_task: boolean
  tool_use_id: string
}

export type DashboardCommitDto = {
  sha: string
  parents: string[]
  author_name: string
  author_email: string
  timestamp: number
  message: string
  files_touched: DashboardCommitFileDiffDto[]
}

export type DashboardCommitRowDto = {
  commit: DashboardCommitDto
  checkpoint: DashboardCheckpointDto
  checkpoints?: DashboardCheckpointDto[]
}

export type DashboardCheckpointSessionDetailDto = {
  session_index: number
  session_id: string
  agent: string
  created_at: string
  is_task: boolean
  tool_use_id: string
  metadata_json: string
  transcript_jsonl: string
  prompts_text: string
  context_text: string
  /**
   * Canonical transcript rows derived by the backend agent's deriver.
   * Empty when the agent has no deriver or transcript_jsonl was unparseable.
   * This is the sole rendering source — the dashboard no longer parses
   * `transcript_jsonl` directly. `transcript_jsonl` remains on the wire for
   * downstream consumers (debug tooling, exports) but should not be parsed
   * for display.
   */
  transcript_entries: DashboardTranscriptEntryDto[]
}

export type DashboardCheckpointDetailResponse = {
  checkpoint_id: string
  strategy: string
  branch: string
  checkpoints_count: number
  files_touched: DashboardCommitFileDiffDto[]
  session_count: number
  token_usage: DashboardTokenUsageDto | null
  sessions: DashboardCheckpointSessionDetailDto[]
}

export type DashboardInteractionActorDto = {
  id: string | null
  name: string | null
  email: string | null
  source: string | null
}

export type DashboardInteractionCommitAuthorDto = {
  checkpoint_id: string
  commit_sha: string
  name: string | null
  email: string | null
  committed_at: string | null
}

export type DashboardInteractionToolUseDto = {
  tool_invocation_id: string
  tool_use_id: string
  session_id: string
  turn_id: string | null
  tool_kind: string | null
  task_description: string | null
  input_summary: string | null
  output_summary: string | null
  source: string | null
  command: string | null
  command_binary: string | null
  command_argv: string[]
  transcript_path: string | null
  started_at: string | null
  ended_at: string | null
}

export type DashboardInteractionSessionDto = {
  session_id: string
  branch: string | null
  actor: DashboardInteractionActorDto | null
  agent_type: string
  model: string | null
  first_prompt: string | null
  started_at: string
  ended_at: string | null
  last_event_at: string | null
  turn_count: number
  checkpoint_count: number
  token_usage: DashboardTokenUsageDto | null
  file_paths: string[]
  tool_uses: DashboardInteractionToolUseDto[]
  linked_checkpoints: DashboardInteractionCommitAuthorDto[]
  latest_commit_author: DashboardInteractionCommitAuthorDto | null
}

export type DashboardInteractionTurnDto = {
  turn_id: string
  session_id: string
  branch: string | null
  actor: DashboardInteractionActorDto | null
  turn_number: number
  prompt: string | null
  summary: string | null
  agent_type: string
  model: string | null
  started_at: string
  ended_at: string | null
  token_usage: DashboardTokenUsageDto | null
  files_modified: string[]
  checkpoint_id: string | null
  tool_uses: DashboardInteractionToolUseDto[]
  /**
   * Canonical transcript rows for this turn, derived by the backend.
   * Empty when the agent's deriver returned nothing. The dashboard renders
   * an empty section in that case rather than parsing raw events — the
   * legacy transcript-fragment fallback has been removed.
   */
  transcript_entries: DashboardTranscriptEntryDto[]
}

export type DashboardInteractionEventDto = {
  event_id: string
  session_id: string
  turn_id: string | null
  event_type: string
  event_time: string
  agent_type: string
  model: string | null
  tool_use_id: string | null
  tool_kind: string | null
  task_description: string | null
  subagent_id: string | null
  payload: unknown | null
}

export type DashboardInteractionSessionDetailResponse = {
  summary: DashboardInteractionSessionDto
  turns: DashboardInteractionTurnDto[]
  raw_events: DashboardInteractionEventDto[]
  /**
   * Canonical transcript rows for the entire session. Used by the session
   * sidebar and tool-use tab. Empty when the backend has no deriver for the
   * session's agent or the transcript was unparseable — in that case the
   * affected panels render an empty state rather than falling back to raw
   * events.
   */
  session_transcript_entries: DashboardTranscriptEntryDto[]
}

export type DashboardInteractionUpdateDto = {
  repo_id: string
  session_count: number
  turn_count: number
  latest_session_id: string | null
  latest_session_updated_at: string | null
  latest_turn_id: string | null
  latest_turn_updated_at: string | null
}
