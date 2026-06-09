import { GLPI_BASE_URL, GLPI_APP_TOKEN, createItem, listItems } from './glpi'

const API_BASE = `${GLPI_BASE_URL}/apirest.php`

const MIME_MAP: Record<string, string> = {
  png:  'image/png',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif:  'image/gif',
}

// Image types required for the import. GLPI must have these in glpi_documenttypes
// with is_uploadable=1 or it silently creates the Document record without saving the file.
const REQUIRED_IMAGE_TYPES = [
  { name: 'PNG Image',  ext: 'png',  mime: 'image/png'  },
  { name: 'JPEG Image', ext: 'jpg',  mime: 'image/jpeg' },
  { name: 'JPEG Image', ext: 'jpeg', mime: 'image/jpeg' },
  { name: 'WebP Image', ext: 'webp', mime: 'image/webp' },
  { name: 'GIF Image',  ext: 'gif',  mime: 'image/gif'  },
]

/**
 * Ensure GLPI has the necessary DocumentType entries for image uploads.
 * GLPI silently skips saving the file if the extension isn't in glpi_documenttypes
 * with is_uploadable=1 — no error is returned, the Document record is created empty.
 */
export async function ensureImageDocumentTypes(token?: string): Promise<void> {
  const sessionToken = (
    token ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('glpi_session_token') : null) ||
    ''
  ).trim()

  let existing: Array<{ id: number; ext?: string; is_uploadable?: number }> = []
  try {
    existing = await listItems('DocumentType', '0-999', sessionToken) as typeof existing
    console.log('[DocumentType] existing types:', existing.map(t => t.ext))
  } catch (e) {
    console.warn('[DocumentType] could not list types:', e)
    return
  }

  const existingExts = new Set(existing.map(t => (t.ext ?? '').toLowerCase().trim()))

  for (const type of REQUIRED_IMAGE_TYPES) {
    if (existingExts.has(type.ext)) {
      console.log(`[DocumentType] ✓ "${type.ext}" already exists`)
      continue
    }
    try {
      const res = await createItem(
        'DocumentType',
        { name: type.name, ext: type.ext, mime: type.mime, is_uploadable: 1 },
        sessionToken,
      )
      console.log(`[DocumentType] ✓ created "${type.ext}":`, res)
    } catch (e) {
      console.warn(`[DocumentType] ✗ could not create "${type.ext}":`, e)
    }
  }
}

/**
 * Upload a file as a GLPI Document (no item link in this request).
 * Call linkDocumentToItem() afterwards to associate it with an asset.
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

  console.log(`[uploadDoc] uploading "${filename}" — ${file.size}B  ${file.type}`)

  const manifest = JSON.stringify({
    input: {
      name,
      entities_id: 0,
      is_recursive: 0,
      _filename: [filename],
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
    console.error(`[uploadDoc] ✗ "${filename}" → HTTP ${response.status}:`, detail)
    throw new Error(`Upload document échoué (${response.status}): ${detail || 'inconnue'}`)
  }

  const result = await response.json()
  console.log(`[uploadDoc] ✓ "${filename}" → GLPI:`, result)

  // GLPI creates the Document record even when the file type is not in DocumentType.
  // In that case result.upload_result exists and flags the failure.
  if (result?.upload_result === false) {
    console.error(`[uploadDoc] ✗ "${filename}" → document créé mais fichier rejeté par GLPI (type non autorisé ?)`, result)
    throw new Error(`Fichier rejeté par GLPI — vérifier que le type "${ext}" est dans les DocumentTypes`)
  }

  const id = Array.isArray(result) ? result[0]?.id : result?.id
  if (!id) throw new Error(`Upload document: ID manquant dans la réponse`)
  return id as number
}

/**
 * Link a Document to an asset via Document_Item.
 * Called after uploadDocumentToGlpi succeeds.
 */
export async function linkDocumentToItem(
  documentId: number,
  itemtype: string,
  itemsId: number,
  token?: string,
): Promise<void> {
  console.log(`[uploadDoc] linking doc#${documentId} → ${itemtype}#${itemsId}`)

  try {
    const res = await createItem(
      'Document_Item',
      { documents_id: documentId, itemtype, items_id: itemsId, entities_id: 0 },
      token,
    )
    console.log(`[uploadDoc] ✓ Document_Item created:`, res)
  } catch (e: unknown) {
    // Document_Item may not be directly creatable via the legacy REST API.
    // Fallback: PUT /Document/{id} with itemtype+items_id triggers GLPI to
    // create the glpi_documents_items row internally.
    console.warn(`[uploadDoc] Document_Item direct creation failed:`, e)
    console.log(`[uploadDoc] trying fallback PUT /Document/${documentId} with item info…`)

    const sessionToken = (
      token ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('glpi_session_token') : null) ||
      ''
    ).trim()

    const res = await fetch(`${API_BASE}/Document/${documentId}`, {
      method: 'PUT',
      headers: {
        'App-Token': GLPI_APP_TOKEN,
        'Session-Token': sessionToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        input: {
          id: documentId,
          itemtype,
          items_id: itemsId,
          entities_id: 0,
        },
      }),
    })

    const text = await res.text()
    console.log(`[uploadDoc] PUT Document fallback → HTTP ${res.status}:`, text)

    if (!res.ok) {
      throw new Error(`Lien doc#${documentId} → ${itemtype}#${itemsId} échoué: HTTP ${res.status}: ${text}`)
    }
  }
}
