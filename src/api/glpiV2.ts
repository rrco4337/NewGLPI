import { GLPI_BASE_URL } from './glpi'

const V2_BASE = `${GLPI_BASE_URL}/api.php/v2.3`
const V2_CLIENT_ID: string = import.meta.env.VITE_GLPI_V2_CLIENT_ID || ''
const V2_CLIENT_SECRET: string = import.meta.env.VITE_GLPI_V2_CLIENT_SECRET || ''
const V2_USERNAME: string = import.meta.env.VITE_GLPI_DEFAULT_USERNAME || 'glpi'
const V2_PASSWORD: string = import.meta.env.VITE_GLPI_V2_PASSWORD || ''

let _cache: { value: string; expiresAt: number } | null = null

async function acquireToken(): Promise<string> {
  if (_cache && Date.now() < _cache.expiresAt) return _cache.value

  if (!V2_CLIENT_ID || !V2_CLIENT_SECRET) {
    throw new Error(
      'GLPI v2 non configuré — ajoutez VITE_GLPI_V2_CLIENT_ID, VITE_GLPI_V2_CLIENT_SECRET et VITE_GLPI_V2_PASSWORD dans .env.local',
    )
  }

  // GLPI v2 requires the password grant to associate a user_id with the token
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: V2_CLIENT_ID,
    client_secret: V2_CLIENT_SECRET,
    username: V2_USERNAME,
    password: V2_PASSWORD,
    scope: 'api',
  })

  const res = await fetch(`${V2_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Authentification GLPI v2 échouée (${res.status}): ${detail}`)
  }

  const data = await res.json()
  const ttl = ((data.expires_in as number) ?? 3600) * 1000
  _cache = { value: data.access_token as string, expiresAt: Date.now() + ttl - 30_000 }
  return _cache.value
}

export function isV2Configured(): boolean {
  return Boolean(V2_CLIENT_ID && V2_CLIENT_SECRET && V2_PASSWORD)
}

// GLPI v2 resources live under /{namespace}/{Type}
// Defaults to "Assets"; use "Assistance" for ticket-related types (Item_Ticket, etc.)
// v2 does not wrap body in { input: {} } — data is sent directly
export async function createItemV2(
  itemType: string,
  data: Record<string, unknown>,
  namespace = 'Assets',
): Promise<{ id: number }> {
  const token = await acquireToken()

  const res = await fetch(`${V2_BASE}/${namespace}/${itemType}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`GLPI v2 ${res.status}: ${detail}`)
  }

  const result = await res.json()
  // v2 returns { id, href } directly
  const id: number = result?.id as number
  if (!id) throw new Error('GLPI v2 : pas d\'ID retourné')
  return { id }
}

export async function deleteItemV2(itemType: string, id: number): Promise<void> {
  const token = await acquireToken()

  const res = await fetch(`${V2_BASE}/Assets/${itemType}/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })

  // 404 = déjà supprimé, toléré
  if (!res.ok && res.status !== 404) {
    const detail = await res.text()
    throw new Error(`GLPI v2 DELETE ${res.status}: ${detail}`)
  }
}
