import JSZip from 'jszip'
import type { ParsedImage } from './types'

const ACCEPTED_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])

/**
 * Convert any image Blob to a real JPEG Blob via Canvas.
 * - PNG transparency is flattened onto a white background.
 * - Uses quality 0.92 (good balance between size and fidelity).
 */
async function toJpeg(source: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(source)
  const canvas = document.createElement('canvas')
  canvas.width  = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null'))),
      'image/jpeg',
      0.92,
    ),
  )
}

/**
 * Extract all image files from a ZIP and normalise them to JPEG.
 * Non-JPEG formats (PNG, WebP, GIF) are converted via Canvas so GLPI
 * always receives a valid image/jpeg file — avoids DocumentType mismatches.
 * The basename (used for asset matching) is preserved unchanged.
 */
export async function extractImagesFromZip(file: File): Promise<ParsedImage[]> {
  const zip = await JSZip.loadAsync(file)
  const images: ParsedImage[] = []

  const entries = Object.values(zip.files).filter(f => !f.dir)

  await Promise.all(
    entries.map(async entry => {
      const filename = entry.name.split('/').pop() ?? entry.name
      if (!filename || filename.startsWith('.')) return

      const dotIdx = filename.lastIndexOf('.')
      if (dotIdx === -1) return

      const origExt  = filename.slice(dotIdx + 1).toLowerCase()
      if (!ACCEPTED_EXTS.has(origExt)) return

      const basename     = filename.slice(0, dotIdx)
      const arrayBuffer  = await entry.async('arraybuffer')
      const origMime     = origExt === 'jpg' || origExt === 'jpeg' ? 'image/jpeg' : `image/${origExt}`
      const origBlob     = new Blob([arrayBuffer], { type: origMime })

      const isJpeg = origExt === 'jpg' || origExt === 'jpeg'

      let finalBlob: Blob
      let finalFilename: string
      let finalExt: string

      if (isJpeg) {
        finalBlob     = origBlob
        finalFilename = filename
        finalExt      = origExt
      } else {
        try {
          finalBlob     = await toJpeg(origBlob)
          finalFilename = `${basename}.jpg`
          finalExt      = 'jpg'
          console.log(`[imageExtractor] "${filename}" → converted to JPEG (${Math.round(finalBlob.size / 1024)}KB)`)
        } catch (e) {
          // Conversion failed — keep original (validators will mark it invalid)
          console.warn(`[imageExtractor] "${filename}" conversion failed, keeping original:`, e)
          finalBlob     = origBlob
          finalFilename = filename
          finalExt      = origExt
        }
      }

      images.push({
        filename:  finalFilename,
        basename,
        ext:       finalExt,
        blob:      finalBlob,
        isValid:   false,   // set asynchronously by validators.ts
        sizeKB:    Math.round(finalBlob.size / 1024),
      })
    }),
  )

  return images
}
