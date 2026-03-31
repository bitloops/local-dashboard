/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiRootResponse } from '../models/ApiRootResponse'
import type { CancelablePromise } from '../core/CancelablePromise'
import type { BaseHttpRequest } from '../core/BaseHttpRequest'
export class SuperHandlersMetaService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * @returns ApiRootResponse Dashboard API root
   * @throws ApiError
   */
  public handleApiRoot(): CancelablePromise<ApiRootResponse> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api',
    })
  }
  /**
   * @returns any Generated OpenAPI document
   * @throws ApiError
   */
  public handleApiOpenapi(): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/openapi.json',
    })
  }
}
