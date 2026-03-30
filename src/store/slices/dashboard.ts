/** Initial stack: first commits page uses `after: null`. */
export const INITIAL_COMMITS_AFTER_STACK: (string | null)[] = [null]

export type DashboardSliceState = {
  /** Cursors for forward-only pagination: `after` used per depth; last element is current page. */
  dashboardCommitsAfterStack: (string | null)[]
}

export type DashboardSliceActions = {
  resetDashboardCommitsPagination: () => void
  /** Append the `after` cursor for the next page (caller fetches with `after = stack[stack.length - 1]` after push). */
  pushDashboardCommitsCursor: (cursor: string) => void
  /** Pop one level; no-op if only the first page remains. */
  popDashboardCommitsCursor: () => void
}

export type DashboardSlice = DashboardSliceState & DashboardSliceActions

type DashboardSet = (
  partial:
    | Partial<DashboardSlice>
    | ((state: DashboardSlice) => Partial<DashboardSlice>),
) => void

export function createDashboardSlice(set: DashboardSet): DashboardSlice {
  return {
    dashboardCommitsAfterStack: [...INITIAL_COMMITS_AFTER_STACK],

    resetDashboardCommitsPagination: () =>
      set({ dashboardCommitsAfterStack: [...INITIAL_COMMITS_AFTER_STACK] }),

    pushDashboardCommitsCursor: (cursor) =>
      set((state) => ({
        dashboardCommitsAfterStack: [
          ...state.dashboardCommitsAfterStack,
          cursor,
        ],
      })),

    popDashboardCommitsCursor: () =>
      set((state) => {
        if (state.dashboardCommitsAfterStack.length <= 1) {
          return state
        }
        return {
          dashboardCommitsAfterStack: state.dashboardCommitsAfterStack.slice(
            0,
            -1,
          ),
        }
      }),
  }
}
