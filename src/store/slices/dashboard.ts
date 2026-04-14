import type {
  DashboardCheckpointDetailResponse,
  DashboardRepositoryOption,
} from '@/features/dashboard/api-types'
import type {
  CheckpointDetailLoadState,
  CommitData,
  UserOption,
} from '@/features/dashboard/types'
import { syncQueryExplorerVariablesWithDashboardSelection } from './query-explorer'

export type DashboardCommitsPageInfo = {
  hasNextPage: boolean
  hasPreviousPage: boolean
  offset: number
}

export type DashboardCommitsRequest = {
  offset: number
}

export type DashboardSliceState = {
  selectedRepoId: string | null
  selectedBranch: string | null
  selectedUser: string | null
  selectedAgent: string | null
  fromDate: Date | undefined
  toDate: Date | undefined
  repoOptions: DashboardRepositoryOption[]
  branchOptions: string[]
  userOptions: UserOption[]
  agentOptions: string[]
  rows: CommitData[]
  commitsPageInfo: DashboardCommitsPageInfo | null
  currentCommitsRequest: DashboardCommitsRequest
  selectedCheckpointId: string | null
  checkpointDetail: DashboardCheckpointDetailResponse | null
  checkpointDetailSource: CheckpointDetailLoadState
}

export type DashboardSliceActions = {
  setSelectedRepoId: (value: string | null) => void
  setSelectedBranch: (value: string | null) => void
  setSelectedUser: (value: string | null) => void
  setSelectedAgent: (value: string | null) => void
  setFromDate: (value: Date | undefined) => void
  setToDate: (value: Date | undefined) => void
  setRepoOptions: (value: DashboardRepositoryOption[]) => void
  setBranchOptions: (value: string[]) => void
  setUserOptions: (value: UserOption[]) => void
  setAgentOptions: (value: string[]) => void
  setRows: (value: CommitData[]) => void
  setCommitsPageInfo: (value: DashboardCommitsPageInfo | null) => void
  setCurrentCommitsRequest: (value: DashboardCommitsRequest) => void
  setSelectedCheckpointId: (value: string | null) => void
  setCheckpointDetail: (value: DashboardCheckpointDetailResponse | null) => void
  setCheckpointDetailSource: (value: CheckpointDetailLoadState) => void
  resetDashboardFilters: () => void
  clearDashboardCache: () => void
}

export type DashboardSlice = DashboardSliceState & DashboardSliceActions

type DashboardSet = (
  partial:
    | Partial<DashboardSlice>
    | ((
        state: DashboardSlice & { variables?: string },
      ) => Partial<DashboardSlice>),
) => void

const INITIAL_COMMITS_REQUEST: DashboardCommitsRequest = { offset: 0 }

function repoIdentityFromId(
  repoOptions: DashboardRepositoryOption[],
  repoId: string | null,
): string | null {
  if (repoId == null) {
    return null
  }

  return (
    repoOptions.find((option) => option.repoId === repoId)?.identity ?? null
  )
}

export function createDashboardSlice(set: DashboardSet): DashboardSlice {
  return {
    selectedRepoId: null,
    selectedBranch: null,
    selectedUser: null,
    selectedAgent: null,
    fromDate: undefined,
    toDate: undefined,
    repoOptions: [],
    branchOptions: [],
    userOptions: [],
    agentOptions: [],
    rows: [],
    commitsPageInfo: null,
    currentCommitsRequest: INITIAL_COMMITS_REQUEST,
    selectedCheckpointId: null,
    checkpointDetail: null,
    checkpointDetailSource: 'idle',
    setSelectedRepoId: (value) =>
      set((state) => {
        const result =
          typeof state.variables === 'string'
            ? syncQueryExplorerVariablesWithDashboardSelection(
                state.variables,
                repoIdentityFromId(state.repoOptions, value),
                state.selectedBranch,
              )
            : { updated: false as const }

        return {
          selectedRepoId: value,
          ...(result.updated ? { variables: result.variables } : {}),
        }
      }),
    setSelectedBranch: (value) =>
      set((state) => {
        const result =
          typeof state.variables === 'string'
            ? syncQueryExplorerVariablesWithDashboardSelection(
                state.variables,
                repoIdentityFromId(state.repoOptions, state.selectedRepoId),
                value,
              )
            : { updated: false as const }

        return {
          selectedBranch: value,
          ...(result.updated ? { variables: result.variables } : {}),
        }
      }),
    setSelectedUser: (value) => set({ selectedUser: value }),
    setSelectedAgent: (value) => set({ selectedAgent: value }),
    setFromDate: (value) => set({ fromDate: value }),
    setToDate: (value) => set({ toDate: value }),
    setRepoOptions: (value) => set({ repoOptions: value }),
    setBranchOptions: (value) => set({ branchOptions: value }),
    setUserOptions: (value) => set({ userOptions: value }),
    setAgentOptions: (value) => set({ agentOptions: value }),
    setRows: (value) => set({ rows: value }),
    setCommitsPageInfo: (value) => set({ commitsPageInfo: value }),
    setCurrentCommitsRequest: (value) => set({ currentCommitsRequest: value }),
    setSelectedCheckpointId: (value) => set({ selectedCheckpointId: value }),
    setCheckpointDetail: (value) => set({ checkpointDetail: value }),
    setCheckpointDetailSource: (value) =>
      set({ checkpointDetailSource: value }),
    resetDashboardFilters: () =>
      set({
        selectedRepoId: null,
        selectedBranch: null,
        selectedUser: null,
        selectedAgent: null,
        fromDate: undefined,
        toDate: undefined,
        currentCommitsRequest: INITIAL_COMMITS_REQUEST,
      }),
    clearDashboardCache: () =>
      set({
        repoOptions: [],
        branchOptions: [],
        userOptions: [],
        agentOptions: [],
        rows: [],
        commitsPageInfo: null,
        currentCommitsRequest: INITIAL_COMMITS_REQUEST,
        selectedCheckpointId: null,
        checkpointDetail: null,
        checkpointDetailSource: 'idle',
      }),
  }
}
