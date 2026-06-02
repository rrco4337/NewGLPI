import { sessionTokenFromFile } from '../lib/sessionToken'

export type ComputerFormData = {
  assetTag: string
  displayName: string
  manufacturer: string
  model: string
  serialNumber: string
  type: string
  status: string
  location: string
  owner: string
  purchaseDate: string
  notes: string
}

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '')

export const GLPI_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_GLPI_BASE_URL || 'http://localhost:8080',
)

export const GLPI_APP_TOKEN = import.meta.env.VITE_GLPI_APP_TOKEN || ''

const API_BASE = `${GLPI_BASE_URL}/apirest.php`

const buildComment = (formData: ComputerFormData) => {
  const lines = [
    formData.manufacturer && `Manufacturer: ${formData.manufacturer}`,
    formData.model && `Model: ${formData.model}`,
    formData.type && `Type: ${formData.type}`,
    formData.status && `Status: ${formData.status}`,
    formData.location && `Location: ${formData.location}`,
    formData.owner && `Owner: ${formData.owner}`,
    formData.purchaseDate && `Purchase date: ${formData.purchaseDate}`,
  ].filter(Boolean)

  if (formData.notes) {
    lines.push(`Notes: ${formData.notes}`)
  }

  return lines.join('\n')
}

type RequestOptions = {
  method: 'GET' | 'POST'
  token?: string
  appToken?: string
  body?: unknown
}

const glpiRequest = async (path: string, options: RequestOptions) => {
  const token = options.token?.trim()
  if (!token) {
    throw new Error('Session token manquant. Ajoute-le dans session-token.txt.')
  }

  const appToken = options.appToken?.trim()
  if (!appToken) {
    throw new Error('App token manquant. Ajoute VITE_GLPI_APP_TOKEN dans .env.local.')
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
  const comment = buildComment(formData)
  const input = {
    name: formData.displayName || formData.assetTag || 'Nouveau poste',
    serial: formData.serialNumber || undefined,
    otherserial: formData.assetTag || undefined,
    comment: comment || undefined,
  }

  return glpiRequest('/Computer', {
    method: 'POST',
    token,
    appToken,
    body: { input },
  })
}
