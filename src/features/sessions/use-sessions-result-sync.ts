import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '@/store'
import { mapDashboardResultDataToSessionRows } from '@/features/sessions/map-dashboard-result-to-session-rows'
import { parseSessionsVariablesJson } from '@/features/sessions/parse-sessions-variables'

type UseSessionsResultSyncOptions = {
  variables: string
}

/**
 * Maps the last successful dashboard GraphQL `result` into `sessionRows` and pagination meta.
 */
export function useSessionsResultSync({ variables }: UseSessionsResultSyncOptions) {
  const { result, setSessionRows, setSessionsPageInfo, setCurrentSessionsRequest } =
    useStore(
      useShallow((s) => ({
        result: s.result,
        setSessionRows: s.setSessionRows,
        setSessionsPageInfo: s.setSessionsPageInfo,
        setCurrentSessionsRequest: s.setCurrentSessionsRequest,
      })),
    )

  useEffect(() => {
    if (result.status !== 'success' || result.data == null) {
      return
    }
    const rows = mapDashboardResultDataToSessionRows(result.data)
    setSessionRows(rows)

    const { limit, offset } = parseSessionsVariablesJson(variables)
    const safeLimit = limit > 0 ? limit : rows.length
    setSessionsPageInfo({
      hasNextPage: safeLimit > 0 && rows.length >= safeLimit,
      hasPreviousPage: offset > 0,
      offset,
    })
    setCurrentSessionsRequest({ offset })
  }, [
    result,
    variables,
    setSessionRows,
    setSessionsPageInfo,
    setCurrentSessionsRequest,
  ])
}
