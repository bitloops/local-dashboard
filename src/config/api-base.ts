/**
 * Base URL for the Bitloops CLI HTTP API (see BitloopsCli client).
 * - Dev: defaults to http://127.0.0.1:5667 when unset.
 * - Prod: defaults to same-origin (`''`) when unset so relative `/api` calls work when hosted with the API.
 */
export function getBitloopsApiBase(): string {
  const fromEnv = import.meta.env.VITE_BITLOOPS_CLI_BASE
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    return fromEnv.trim()
  }
  if (import.meta.env.PROD) {
    return ''
  }
  return 'http://127.0.0.1:5667'
}
