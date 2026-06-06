import { sessionTokenFromFile } from '@/lib/sessionToken'
import type { ComputerFormData } from '@/types/glpi'

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '')

export const GLPI_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_GLPI_BASE_URL || 'http://localhost:8080',
)

export const GLPI_APP_TOKEN: string = import.meta.env.VITE_GLPI_APP_TOKEN || ''

const API_BASE = `${GLPI_BASE_URL}/apirest.php`

type RequestOptions = {
  method: 'GET' | 'POST' | 'DELETE' | 'PUT'
  token?: string
  appToken?: string
  body?: unknown
  headers?: Record<string, string>
}

const glpiRequest = async (path: string, options: RequestOptions) => {
  const token = options.token?.trim()
  if (!token && !options.headers?.Authorization) {
    throw new Error('Session token manquant. Ajoutez VITE_GLPI_SESSION_TOKEN dans .env.local.')
  }

  const appToken = options.appToken?.trim()
  if (!appToken) {
    throw new Error('App token manquant. Ajoutez VITE_GLPI_APP_TOKEN dans .env.local.')
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'App-Token': appToken,
      ...(token ? { 'Session-Token': token } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Erreur GLPI ${response.status}: ${detail || 'inconnue'}`)
  }

  return response.json()
}

export const testSession = async (
  token = sessionTokenFromFile,
  appToken = GLPI_APP_TOKEN,
) => glpiRequest('/getMyProfiles', { method: 'GET', token, appToken })

export const createComputer = async (
  formData: ComputerFormData,
  token = sessionTokenFromFile,
  appToken = GLPI_APP_TOKEN,
) => {
  const input = {
    name: formData.displayName || formData.assetTag || 'Nouveau poste',
    serial: formData.serialNumber || undefined,
    otherserial: formData.assetTag || undefined,
    comment:
      [
        formData.manufacturer && `Fabricant: ${formData.manufacturer}`,
        formData.model && `Modèle: ${formData.model}`,
        formData.type && `Type: ${formData.type}`,
        formData.status && `Statut: ${formData.status}`,
        formData.location && `Localisation: ${formData.location}`,
        formData.owner && `Utilisateur: ${formData.owner}`,
        formData.purchaseDate && `Date d'achat: ${formData.purchaseDate}`,
        formData.notes && `Notes: ${formData.notes}`,
      ]
        .filter(Boolean)
        .join('\n') || undefined,
  }

  return glpiRequest('/Computer', {
    method: 'POST',
    token,
    appToken,
    body: { input },
  })
}

export const initSession = async (
  username?: string,
  password?: string,
  appToken = GLPI_APP_TOKEN,
) => {
  const authString = btoa(`${username || ''}:${password || ''}`)
  return glpiRequest('/initSession', {
    method: 'GET',
    appToken,
    headers: {
      Authorization: `Basic ${authString}`
    }
  })
}

/**
 * List all items of a given GLPI item type.
 * Uses range-based pagination. Returns an array of items.
 * Pass expandDropdowns=true to resolve dropdown IDs to human-readable names.
 */
export const listItems = async (
  itemType: string,
  range = '0-999',
  token?: string,
  appToken = GLPI_APP_TOKEN,
  expandDropdowns = false,
) => {
  const sessionToken = token || localStorage.getItem('glpi_session_token') || sessionTokenFromFile
  const result = await glpiRequest(`/${itemType}?range=${range}&expand_dropdowns=${expandDropdowns}`, {
    method: 'GET',
    token: sessionToken,
    appToken,
  })
  return Array.isArray(result) ? result : []
}

/**
 * Count items for a given type. Returns the total.
 */
export const countItems = async (
  itemType: string,
  token?: string,
  appToken = GLPI_APP_TOKEN,
) => {
  const sessionToken = token || localStorage.getItem('glpi_session_token') || sessionTokenFromFile
  try {
    const items = await glpiRequest(`/${itemType}?range=0-0`, {
      method: 'GET',
      token: sessionToken,
      appToken,
    })
    return Array.isArray(items) ? items.length : 0
  } catch {
    return 0
  }
}

/**
 * Delete items of a given GLPI item type by their IDs.
 * Uses mass delete (force_purge=1 to permanently remove).
 */
export const deleteItems = async (
  itemType: string,
  ids: number[],
  token?: string,
  appToken = GLPI_APP_TOKEN,
) => {
  const sessionToken = token || localStorage.getItem('glpi_session_token') || sessionTokenFromFile
  const input = ids.map(id => ({ id }))
  return glpiRequest(`/${itemType}?force_purge=1`, {
    method: 'DELETE',
    token: sessionToken,
    appToken,
    body: { input },
  })
}

/**
 * Mass-delete all items of a given type (up to `range` items).
 * Returns the count of deleted items.
 */
export const purgeAllItems = async (
  itemType: string,
  token?: string,
  appToken = GLPI_APP_TOKEN,
): Promise<{ deleted: number; errors: string[] }> => {
  const errors: string[] = []
  let deleted = 0
  try {
    const items = await listItems(itemType, '0-9999', token, appToken)
    if (items.length === 0) return { deleted: 0, errors }
    const ids = items.map((item: { id: number }) => item.id)
    // Delete in batches of 50
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50)
      try {
        await deleteItems(itemType, batch, token, appToken)
        deleted += batch.length
      } catch (err: any) {
        errors.push(`${itemType} batch ${i / 50 + 1}: ${err.message}`)
      }
    }
  } catch (err: any) {
    errors.push(`${itemType}: ${err.message}`)
  }
  return { deleted, errors }
}

/**
 * Purge non-admin users from GLPI.
 * Admin users are identified by having a profile whose name contains "admin" (case-insensitive).
 * User ID 1 (the built-in glpi superadmin) is always preserved.
 */
export const purgeNonAdminUsers = async (
  token?: string,
  appToken = GLPI_APP_TOKEN,
): Promise<{ deleted: number; skipped: number; errors: string[] }> => {
  const sessionToken = token || localStorage.getItem('glpi_session_token') || sessionTokenFromFile
  const errors: string[] = []
  let deleted = 0
  let skipped = 0

  try {
    // Identify admin profile IDs (name contains "admin")
    const profiles = await listItems('Profile', '0-999', sessionToken, appToken) as Array<{ id: number; name: string }>
    const adminProfileIds = new Set(
      profiles.filter(p => /admin/i.test(p.name ?? '')).map(p => p.id)
    )

    // Collect user IDs linked to admin profiles
    const profileUsers = await listItems('Profile_User', '0-9999', sessionToken, appToken) as Array<{ users_id: number; profiles_id: number }>
    const adminUserIds = new Set<number>([1]) // always preserve built-in glpi admin
    for (const pu of profileUsers) {
      if (adminProfileIds.has(pu.profiles_id)) adminUserIds.add(pu.users_id)
    }

    // Get all users, filter to non-admin
    const users = await listItems('User', '0-9999', sessionToken, appToken) as Array<{ id: number }>
    const toDelete = users.filter(u => !adminUserIds.has(u.id))
    skipped = users.length - toDelete.length

    if (toDelete.length === 0) return { deleted: 0, skipped, errors }

    const ids = toDelete.map(u => u.id)
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50)
      try {
        await deleteItems('User', batch, sessionToken, appToken)
        deleted += batch.length
      } catch (err: unknown) {
        errors.push(`Users batch ${Math.floor(i / 50) + 1}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  } catch (err: unknown) {
    errors.push(`Users: ${err instanceof Error ? err.message : String(err)}`)
  }

  return { deleted, skipped, errors }
}

/**
 * Import a single item into GLPI.
 */
export const createItem = async (
  itemType: string,
  data: Record<string, unknown>,
  token?: string,
  appToken = GLPI_APP_TOKEN,
) => {
  const sessionToken = token || localStorage.getItem('glpi_session_token') || sessionTokenFromFile
  return glpiRequest(`/${itemType}`, {
    method: 'POST',
    token: sessionToken,
    appToken,
    body: { input: data },
  })
}
