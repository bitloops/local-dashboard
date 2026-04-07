/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */

import type { ApiCommitFileDiffDto } from './ApiCommitFileDiffDto'
import type { ApiTokenUsageDto } from './ApiTokenUsageDto'
export type ApiCheckpointDto = {
  agents: Array<string>
  branch: string
  checkpoint_id: string
  checkpoints_count: number
  created_at: string
  files_touched: Array<ApiCommitFileDiffDto>
  first_prompt_preview: string
  is_task: boolean
  session_count: number
  session_id: string
  strategy: string
  token_usage?: null | ApiTokenUsageDto
  tool_use_id: string
}
