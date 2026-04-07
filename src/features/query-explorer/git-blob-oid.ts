/** Git blob object id: 40 hex (SHA-1) or 64 hex (SHA-256 object format). */
export function isGitBlobOid(value: string): boolean {
  const t = value.trim().toLowerCase()
  if (t.length !== 40 && t.length !== 64) return false
  return /^[0-9a-f]+$/.test(t)
}
