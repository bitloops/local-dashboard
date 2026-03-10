/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
 
import type { ApiFileChangeStatsDto } from './ApiFileChangeStatsDto';
import type { ApiTokenUsageDto } from './ApiTokenUsageDto';
export type ApiCheckpointDto = {
    agent: string;
    branch: string;
    checkpoint_id: string;
    checkpoints_count: number;
    created_at: string;
    files_touched: Array<ApiFileChangeStatsDto>;
    is_task: boolean;
    session_count: number;
    session_id: string;
    strategy: string;
    token_usage?: (null | ApiTokenUsageDto);
    tool_use_id: string;
};
