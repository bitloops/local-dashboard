/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiAgentDto } from '../models/ApiAgentDto';
import type { ApiBranchSummaryDto } from '../models/ApiBranchSummaryDto';
import type { ApiCheckpointDetailResponse } from '../models/ApiCheckpointDetailResponse';
import type { ApiCommitRowDto } from '../models/ApiCommitRowDto';
import type { ApiKpisResponse } from '../models/ApiKpisResponse';
import type { ApiRootResponse } from '../models/ApiRootResponse';
import type { ApiUserDto } from '../models/ApiUserDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class DefaultService {
    public readonly httpRequest: BaseHttpRequest;
    constructor(httpRequest: BaseHttpRequest) {
        this.httpRequest = httpRequest;
    }
    /**
     * @returns ApiRootResponse Dashboard API root
     * @throws ApiError
     */
    public handleApiRoot(): CancelablePromise<ApiRootResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api',
        });
    }
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
        branch: string | null,
        from: string | null,
        to: string | null,
        user: string | null,
    }): CancelablePromise<Array<ApiAgentDto>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/agents',
            path: {
                'branch': branch,
                'from': from,
                'to': to,
                'user': user,
            },
            errors: {
                400: `Bad request`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * @returns ApiBranchSummaryDto Branches with at least one checkpoint commit
     * @throws ApiError
     */
    public handleApiBranches({
        from,
        to,
    }: {
        from: string | null,
        to: string | null,
    }): CancelablePromise<Array<ApiBranchSummaryDto>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/branches',
            path: {
                'from': from,
                'to': to,
            },
            errors: {
                400: `Bad request`,
                500: `Internal server error`,
            },
        });
    }
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
        checkpointId: string,
    }): CancelablePromise<ApiCheckpointDetailResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/checkpoints/{checkpoint_id}',
            path: {
                'checkpoint_id': checkpointId,
            },
            errors: {
                400: `Bad request`,
                404: `Not found`,
                500: `Internal server error`,
            },
        });
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
        branch: string | null,
        from: string | null,
        to: string | null,
        user: string | null,
        agent: string | null,
        limit: string | null,
        offset: string | null,
    }): CancelablePromise<Array<ApiCommitRowDto>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/commits',
            path: {
                'branch': branch,
                'from': from,
                'to': to,
                'user': user,
                'agent': agent,
                'limit': limit,
                'offset': offset,
            },
            errors: {
                400: `Bad request`,
                500: `Internal server error`,
            },
        });
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
        branch: string | null,
        from: string | null,
        to: string | null,
        user: string | null,
        agent: string | null,
    }): CancelablePromise<ApiKpisResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/kpis',
            path: {
                'branch': branch,
                'from': from,
                'to': to,
                'user': user,
                'agent': agent,
            },
            errors: {
                400: `Bad request`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * @returns any Generated OpenAPI document
     * @throws ApiError
     */
    public handleApiOpenapi(): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/openapi.json',
        });
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
        branch: string | null,
        from: string | null,
        to: string | null,
        agent: string | null,
    }): CancelablePromise<Array<ApiUserDto>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/users',
            path: {
                'branch': branch,
                'from': from,
                'to': to,
                'agent': agent,
            },
            errors: {
                400: `Bad request`,
                500: `Internal server error`,
            },
        });
    }
}
