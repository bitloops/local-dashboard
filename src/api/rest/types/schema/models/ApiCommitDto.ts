/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */

import type { ApiCommitFileDiffDto } from './ApiCommitFileDiffDto'
export type ApiCommitDto = {
  author_email: string
  author_name: string
  files_touched: Array<ApiCommitFileDiffDto>
  message: string
  parents: Array<string>
  sha: string
  timestamp: number
}
