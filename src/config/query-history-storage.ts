import type { HistoryEntry } from '@/store/types'

/** Persisted preference (always in localStorage). */
export const STORAGE_MODE_KEY = 'query-explorer-storage-mode'

/** Run history blob key in localStorage or sessionStorage. */
export const RUN_HISTORY_KEY = 'query-explorer-history'

export type HistoryStorageMode = 'local' | 'session' | 'off'

export function parseHistoryStorageMode(
  raw: string | null,
): HistoryStorageMode {
  if (raw === 'session' || raw === 'off' || raw === 'local') return raw
  return 'local'
}

export function getHistoryStorageModeFromWindow(
  w: Window & typeof globalThis,
): HistoryStorageMode {
  try {
    return parseHistoryStorageMode(w.localStorage.getItem(STORAGE_MODE_KEY))
  } catch {
    return 'local'
  }
}

/** Returns null when mode is `off` or accessing storage throws (e.g. SecurityError). */
export function getHistoryStorageForMode(
  w: Window & typeof globalThis,
  mode: HistoryStorageMode,
): Storage | null {
  if (mode === 'off') return null
  try {
    return mode === 'session' ? w.sessionStorage : w.localStorage
  } catch {
    return null
  }
}

/** Returns null when mode is `off` (no persistence). */
export function getHistoryStorage(
  w: Window & typeof globalThis,
): Storage | null {
  const mode = getHistoryStorageModeFromWindow(w)
  return getHistoryStorageForMode(w, mode)
}

export function getHistoryTtlMs(): number {
  const raw = import.meta.env.VITE_QUERY_HISTORY_TTL_MS
  const n = Number(raw)
  if (raw !== undefined && raw !== '' && Number.isFinite(n) && n > 0) {
    return n
  }
  return 30 * 24 * 60 * 60 * 1000
}

export function pruneHistoryByTtl(
  entries: HistoryEntry[],
  now: number,
  ttlMs: number,
): HistoryEntry[] {
  return entries.filter((e) => now - e.runAt <= ttlMs)
}
