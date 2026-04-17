/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_QUERY_HISTORY_TTL_MS?: string
  /** When `"true"`, dashboard GraphQL requests are served from in-browser mocks (no backend). */
  readonly VITE_DASHBOARD_API_MOCK?: string
}
