const CACHE_PREFIX = 'glpi_cache_'
const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24h

export const saveCache = (key: string, data: unknown): void => {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data }))
  } catch { /* storage full — ignore */ }
}

export const loadCache = <T>(key: string): { data: T; ts: number } | null => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { ts: number; data: T }
    if (Date.now() - parsed.ts > MAX_AGE_MS) return null
    return parsed
  } catch {
    return null
  }
}

export const formatCacheDate = (ts: number): string =>
  new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
