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
 */
export const listItems = async (
  itemType: string,
  range = '0-999',
  token?: string,
  appToken = GLPI_APP_TOKEN,
) => {
  const sessionToken = token || localStorage.getItem('glpi_session_token') || sessionTokenFromFile
  const result = await glpiRequest(`/${itemType}?range=${range}&expand_dropdowns=false`, {
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
