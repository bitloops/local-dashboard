/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiCheckBundleVersionResponse } from '../models/ApiCheckBundleVersionResponse'
import type { ApiFetchBundleResponse } from '../models/ApiFetchBundleResponse'
import type { CancelablePromise } from '../core/CancelablePromise'
import type { BaseHttpRequest } from '../core/BaseHttpRequest'
export class SuperHandlersBundleService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * @returns ApiCheckBundleVersionResponse Dashboard bundle install/update availability
   * @throws ApiError
   */
  public handleApiCheckBundleVersion(): CancelablePromise<ApiCheckBundleVersionResponse> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/check_bundle_version',
      errors: {
        500: `Internal server error`,
        502: `Manifest fetch failure`,
      },
    })
  }
  /**
   * @returns ApiFetchBundleResponse Bundle fetched and installed
   * @throws ApiError
   */
  public handleApiFetchBundle({
    requestBody,
  }: {
    requestBody: any
  }): CancelablePromise<ApiFetchBundleResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/fetch_bundle',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        409: `No compatible version`,
        422: `Checksum mismatch`,
        500: `Install failure`,
        502: `Download/manifest fetch failure`,
      },
    })
  }
}
