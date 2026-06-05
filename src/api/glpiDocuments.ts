import { GLPI_BASE_URL, GLPI_APP_TOKEN, createItem } from './glpi'

const API_BASE = `${GLPI_BASE_URL}/apirest.php`

const MIME_MAP: Record<string, string> = {
  png:  'image/png',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif:  'image/gif',
}

/**
 * Step 1: Upload a file as a GLPI Document (no item link in this request).
 *
 * Separating upload from linking avoids a GLPI transaction issue where
 * including itemtype/items_id in the manifest causes an atomic Document +
 * Document_Item insert; if the link insert fails for any reason, GLPI rolls
 * back the whole operation — including the file move — and returns the
 * misleading error "Fichier X introuvable."
 *
 * Returns the new Document ID.
 */
export async function uploadDocumentToGlpi(
  name: string,
  imageBlob: Blob,
  filename: string,
  token?: string,
  appToken = GLPI_APP_TOKEN,
): Promise<number> {
  const sessionToken = (
    token ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('glpi_session_token') : null) ||
    ''
  ).trim()

  if (!sessionToken) throw new Error('Session token manquant pour l\'upload de document')
  if (!appToken) throw new Error('App token manquant pour l\'upload de document')

  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const mimeType = imageBlob.type || MIME_MAP[ext] || 'application/octet-stream'

  // Re-read blob as raw bytes → fresh File object (avoids stale internal buffers)
  const arrayBuffer = await imageBlob.arrayBuffer()
  const file = new File([arrayBuffer], filename, { type: mimeType })

  console.log(`[uploadDoc] upload "${filename}" — ${file.size}B  ${file.type}`)

  const manifest = JSON.stringify({
    input: {
      name,
      entities_id: 0,
      is_recursive: 0,
      _filename: [filename],
      // itemtype / items_id intentionally omitted — link created separately via Document_Item
    },
  })

  const formData = new FormData()
  formData.set('uploadManifest', manifest)
  formData.append('filename[0]', file)

  const response = await fetch(`${API_BASE}/Document`, {
    method: 'POST',
    headers: {
      'App-Token': appToken,
      'Session-Token': sessionToken,
    },
    body: formData,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error(`[uploadDoc] ✗ "${filename}" → ${response.status}:`, detail)
    throw new Error(`Upload document échoué (${response.status}): ${detail || 'inconnue'}`)
  }

  const result = await response.json()
  console.log(`[uploadDoc] ✓ "${filename}" → GLPI:`, result)

  const id = Array.isArray(result) ? result[0]?.id : result?.id
  if (!id) throw new Error(`Upload document: ID manquant dans la réponse`)
  return id as number
}

/**
 * Step 2: Link a Document to an asset via Document_Item.
 * Called after uploadDocumentToGlpi succeeds.
 */
export async function linkDocumentToItem(
  documentId: number,
  itemtype: 'Computer' | 'Monitor',
  itemsId: number,
  token?: string,
): Promise<void> {
  console.log(`[uploadDoc] link doc#${documentId} → ${itemtype}#${itemsId}`)
  await createItem(
    'Document_Item',
    { documents_id: documentId, itemtype, items_id: itemsId, entities_id: 0 },
    token,
  )
}
