import JSZip from 'jszip'
import type { ParsedImage } from './types'

const ACCEPTED_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp'])

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

/**
 * Extract all image files from a ZIP file.
 * Returns a list of ParsedImage objects (validity is checked later by the validator).
 */
export async function extractImagesFromZip(file: File): Promise<ParsedImage[]> {
  const zip = await JSZip.loadAsync(file)
  const images: ParsedImage[] = []

  const entries = Object.values(zip.files).filter(f => !f.dir)

  await Promise.all(
    entries.map(async entry => {
      // Strip leading directories
      const filename = entry.name.split('/').pop() ?? entry.name
      if (!filename || filename.startsWith('.')) return

      const dotIdx = filename.lastIndexOf('.')
      if (dotIdx === -1) return

      const ext = filename.slice(dotIdx + 1).toLowerCase()
      if (!ACCEPTED_EXTS.has(ext)) return

      const basename = filename.slice(0, dotIdx)
      const arrayBuffer = await entry.async('arraybuffer')
      const blob = new Blob([arrayBuffer], { type: MIME[ext] ?? 'application/octet-stream' })

      images.push({
        filename,
        basename,
        ext,
        blob,
        isValid: false, // validated asynchronously in validators.ts
        sizeKB: Math.round(arrayBuffer.byteLength / 1024),
      })
    }),
  )

  return images
}
