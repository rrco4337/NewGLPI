import { GLPI_BASE_URL, GLPI_APP_TOKEN } from './glpi'

const API_BASE = `${GLPI_BASE_URL}/apirest.php`

/**
 * Upload an image as a GLPI native Document and link it to an asset.
 * Returns the new Document ID.
 *
 * GLPI stores the file in glpi_documents and creates the association
 * in glpi_documents_items automatically when itemtype + items_id are supplied.
 */
export async function uploadDocumentToGlpi(
  name: string,
  imageBlob: Blob,
  filename: string,
  itemtype: 'Computer' | 'Monitor',
  itemsId: number,
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

  const manifest = JSON.stringify({
    input: {
      name,
      entities_id: 0,
      is_recursive: 0,
      itemtype,
      items_id: itemsId,
      filename,
    },
  })

  const formData = new FormData()
  formData.set('uploadManifest', manifest)
  formData.append('filename[0]', imageBlob, filename)

  const response = await fetch(`${API_BASE}/Document`, {
    method: 'POST',
    headers: {
      'App-Token': appToken,
      'Session-Token': sessionToken,
      // No Content-Type – browser sets multipart/form-data with boundary
    },
    body: formData,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Upload document échoué (${response.status}): ${detail || 'inconnue'}`)
  }

  const result = await response.json()
  // GLPI returns either {id: N} or [{id: N}]
  const id = Array.isArray(result) ? result[0]?.id : result?.id
  if (!id) throw new Error(`Upload document: ID manquant dans la réponse`)
  return id as number
}
