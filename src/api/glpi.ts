import { sessionTokenFromFile } from '@/lib/sessionToken'
import type { ComputerFormData } from '@/types/glpi'

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '')

export const GLPI_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_GLPI_BASE_URL || 'http://localhost:8080',
)

export const GLPI_APP_TOKEN: string = import.meta.env.VITE_GLPI_APP_TOKEN || ''

const API_BASE = `${GLPI_BASE_URL}/apirest.php`

type RequestOptions = {
  method: 'GET' | 'POST'
  token?: string
  appToken?: string
  body?: unknown
}

const glpiRequest = async (path: string, options: RequestOptions) => {
  const token = options.token?.trim()
  if (!token) {
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
      'Session-Token': token,
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
