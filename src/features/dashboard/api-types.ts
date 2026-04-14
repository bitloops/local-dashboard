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
