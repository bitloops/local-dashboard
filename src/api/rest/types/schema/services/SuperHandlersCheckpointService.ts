/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiCheckpointDetailResponse } from '../models/ApiCheckpointDetailResponse'
import type { CancelablePromise } from '../core/CancelablePromise'
import type { BaseHttpRequest } from '../core/BaseHttpRequest'
export class SuperHandlersCheckpointService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * @returns ApiCheckpointDetailResponse Checkpoint details with session transcript payloads
   * @throws ApiError
   */
  public handleApiCheckpoint({
    checkpointId,
  }: {
    /**
     * Checkpoint id (12 hex characters)
     */
    checkpointId: string
  }): CancelablePromise<ApiCheckpointDetailResponse> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/checkpoints/{checkpoint_id}',
      path: {
        checkpoint_id: checkpointId,
      },
      errors: {
        400: `Bad request`,
        404: `Not found`,
        500: `Internal server error`,
      },
    })
  }
}
