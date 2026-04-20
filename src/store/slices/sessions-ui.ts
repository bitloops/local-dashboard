import type { StoreApi } from 'zustand'

export type SessionsUiSliceState = {
  /** After first apply of Sessions landing defaults; avoids resetting query when returning to `/`. */
  sessionsLandingDefaultsApplied: boolean
}

export type SessionsUiSliceActions = {
  setSessionsLandingDefaultsApplied: (value: boolean) => void
}

export type SessionsUiSlice = SessionsUiSliceState & SessionsUiSliceActions

export function createSessionsUiSlice(
  set: StoreApi<SessionsUiSlice>['setState'],
): SessionsUiSlice {
  return {
    sessionsLandingDefaultsApplied: false,
    setSessionsLandingDefaultsApplied: (value) =>
      set({ sessionsLandingDefaultsApplied: value }),
  }
}
