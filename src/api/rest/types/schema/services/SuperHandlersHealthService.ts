/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */

import type { ApiDbHealthResponse } from '../models/ApiDbHealthResponse'
import type { CancelablePromise } from '../core/CancelablePromise'
import type { BaseHttpRequest } from '../core/BaseHttpRequest'
export class SuperHandlersHealthService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * @returns ApiDbHealthResponse Live database backend health
   * @throws ApiError
   */
  public handleApiDbHealth(): CancelablePromise<ApiDbHealthResponse> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/db/health',
    })
  }
}
