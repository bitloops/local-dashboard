/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiCheckpointSessionDetailDto } from './ApiCheckpointSessionDetailDto';
import type { ApiTokenUsageDto } from './ApiTokenUsageDto';
export type ApiCheckpointDetailResponse = {
    branch: string;
    checkpoint_id: string;
    checkpoints_count: number;
    files_touched: Array<string>;
    session_count: number;
    sessions: Array<ApiCheckpointSessionDetailDto>;
    strategy: string;
    token_usage?: (null | ApiTokenUsageDto);
};

