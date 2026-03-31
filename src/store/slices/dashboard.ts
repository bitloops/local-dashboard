import type { ApiCheckpointDetailResponse } from '@/api/rest'
import type {
  CheckpointDetailLoadState,
  CommitData,
  UserOption,
} from '@/features/dashboard/types'

export type DashboardCommitsPageInfo = {
  hasNextPage: boolean
  hasPreviousPage: boolean
  startCursor: string | null
  endCursor: string | null
}

export type DashboardCommitsRequest =
  | {
      direction?: 'forward'
      after: string | null
      before?: never
    }
  | {
      direction: 'backward'
      before: string | null
      after?: never
    }

export type DashboardSliceState = {
  selectedBranch: string | null
  selectedUser: string | null
  selectedAgent: string | null
  fromDate: Date | undefined
  toDate: Date | undefined
  branchOptions: string[]
  userOptions: UserOption[]
  agentOptions: string[]
  rows: CommitData[]
  commitsPageInfo: DashboardCommitsPageInfo | null
  currentCommitsRequest: DashboardCommitsRequest
  selectedCheckpointId: string | null
  checkpointDetail: ApiCheckpointDetailResponse | null
  checkpointDetailSource: CheckpointDetailLoadState
}

export type DashboardSliceActions = {
  setSelectedBranch: (value: string | null) => void
  setSelectedUser: (value: string | null) => void
  setSelectedAgent: (value: string | null) => void
  setFromDate: (value: Date | undefined) => void
  setToDate: (value: Date | undefined) => void
  setBranchOptions: (value: string[]) => void
  setUserOptions: (value: UserOption[]) => void
  setAgentOptions: (value: string[]) => void
  setRows: (value: CommitData[]) => void
  setCommitsPageInfo: (value: DashboardCommitsPageInfo | null) => void
  setCurrentCommitsRequest: (value: DashboardCommitsRequest) => void
  setSelectedCheckpointId: (value: string | null) => void
  setCheckpointDetail: (value: ApiCheckpointDetailResponse | null) => void
  setCheckpointDetailSource: (value: CheckpointDetailLoadState) => void
  resetDashboardFilters: () => void
  clearDashboardCache: () => void
}

export type DashboardSlice = DashboardSliceState & DashboardSliceActions

type DashboardSet = (
  partial:
    | Partial<DashboardSlice>
    | ((state: DashboardSlice) => Partial<DashboardSlice>),
) => void

const INITIAL_COMMITS_REQUEST: DashboardCommitsRequest = { after: null }

export function createDashboardSlice(set: DashboardSet): DashboardSlice {
  return {
    selectedBranch: null,
    selectedUser: null,
    selectedAgent: null,
    fromDate: undefined,
    toDate: undefined,
    branchOptions: [],
    userOptions: [],
    agentOptions: [],
    rows: [],
    commitsPageInfo: null,
    currentCommitsRequest: INITIAL_COMMITS_REQUEST,
    selectedCheckpointId: null,
    checkpointDetail: null,
    checkpointDetailSource: 'idle',
    setSelectedBranch: (value) => set({ selectedBranch: value }),
    setSelectedUser: (value) => set({ selectedUser: value }),
    setSelectedAgent: (value) => set({ selectedAgent: value }),
    setFromDate: (value) => set({ fromDate: value }),
    setToDate: (value) => set({ toDate: value }),
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
        selectedBranch: null,
        selectedUser: null,
        selectedAgent: null,
        fromDate: undefined,
        toDate: undefined,
        currentCommitsRequest: INITIAL_COMMITS_REQUEST,
      }),
    clearDashboardCache: () =>
      set({
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
