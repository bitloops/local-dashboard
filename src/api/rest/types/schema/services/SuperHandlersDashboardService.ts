/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */

import type { ApiAgentDto } from '../models/ApiAgentDto'
import type { ApiBranchSummaryDto } from '../models/ApiBranchSummaryDto'
import type { ApiCommitRowDto } from '../models/ApiCommitRowDto'
import type { ApiKpisResponse } from '../models/ApiKpisResponse'
import type { ApiRepositoryDto } from '../models/ApiRepositoryDto'
import type { ApiUserDto } from '../models/ApiUserDto'
import type { CancelablePromise } from '../core/CancelablePromise'
import type { BaseHttpRequest } from '../core/BaseHttpRequest'
export class SuperHandlersDashboardService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * @returns ApiAgentDto Agents in filtered checkpoint commits
   * @throws ApiError
   */
  public handleApiAgents({
    branch,
    from,
    to,
    user,
  }: {
    branch: string | null
    from: string | null
    to: string | null
    user: string | null
  }): CancelablePromise<Array<ApiAgentDto>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/agents',
      path: {
        branch: branch,
        from: from,
        to: to,
        user: user,
      },
      errors: {
        400: `Bad request`,
        500: `Internal server error`,
      },
    })
  }
  /**
   * @returns ApiBranchSummaryDto Branches with at least one checkpoint commit
   * @throws ApiError
   */
  public handleApiBranches({
    from,
    to,
  }: {
    from: string | null
    to: string | null
  }): CancelablePromise<Array<ApiBranchSummaryDto>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/branches',
      path: {
        from: from,
        to: to,
      },
      errors: {
        400: `Bad request`,
        500: `Internal server error`,
      },
    })
  }
  /**
   * @returns ApiCommitRowDto Filtered commit + checkpoint rows
   * @throws ApiError
   */
  public handleApiCommits({
    branch,
    from,
    to,
    user,
    agent,
    limit,
    offset,
  }: {
    branch: string | null
    from: string | null
    to: string | null
    user: string | null
    agent: string | null
    limit: string | null
    offset: string | null
  }): CancelablePromise<Array<ApiCommitRowDto>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/commits',
      path: {
        branch: branch,
        from: from,
        to: to,
        user: user,
        agent: agent,
        limit: limit,
        offset: offset,
      },
      errors: {
        400: `Bad request`,
        500: `Internal server error`,
      },
    })
  }
  /**
   * @returns ApiKpisResponse Aggregated KPI metrics
   * @throws ApiError
   */
  public handleApiKpis({
    branch,
    from,
    to,
    user,
    agent,
  }: {
    branch: string | null
    from: string | null
    to: string | null
    user: string | null
    agent: string | null
  }): CancelablePromise<ApiKpisResponse> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/kpis',
      path: {
        branch: branch,
        from: from,
        to: to,
        user: user,
        agent: agent,
      },
      errors: {
        400: `Bad request`,
        500: `Internal server error`,
      },
    })
  }
  /**
   * @returns ApiRepositoryDto Known repositories for the dashboard
   * @throws ApiError
   */
  public handleApiRepositories(): CancelablePromise<Array<ApiRepositoryDto>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/repositories',
      errors: {
        500: `Internal server error`,
      },
    })
  }
  /**
   * @returns ApiUserDto Users in filtered checkpoint commits
   * @throws ApiError
   */
  public handleApiUsers({
    branch,
    from,
    to,
    agent,
  }: {
    branch: string | null
    from: string | null
    to: string | null
    agent: string | null
  }): CancelablePromise<Array<ApiUserDto>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/users',
      path: {
        branch: branch,
        from: from,
        to: to,
        agent: agent,
      },
      errors: {
        400: `Bad request`,
        500: `Internal server error`,
      },
    })
  }
}
