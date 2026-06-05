import { normalizeHeader } from './columnSynonyms'

export type RawRow = Record<string, string>

/**
 * Parse a CSV text into an array of objects keyed by canonical field names.
 * - Auto-detects separator (comma or semicolon).
 * - Strips BOM if present.
 * - Headers are normalized via the synonym dictionary.
 * - Unknown headers are kept as-is.
 */
export function parseCsvText(csvText: string): { rows: RawRow[]; unknownHeaders: string[] } {
  // Strip UTF-8 BOM
  const text = csvText.replace(/^﻿/, '')
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { rows: [], unknownHeaders: [] }

  // Detect separator
  const firstLine = lines[0]
  const separator = firstLine.includes(';') ? ';' : ','

  const rawHeaders = splitRespectingQuotes(firstLine, separator)
  const unknownHeaders: string[] = []

  const canonicalHeaders = rawHeaders.map(h => {
    const raw = h.trim().replace(/^["']|["']$/g, '')
    const canonical = normalizeHeader(raw)
    if (!canonical) unknownHeaders.push(raw)
    return canonical ?? raw
  })

  const rows: RawRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = splitRespectingQuotes(line, separator)
    const row: RawRow = {}

    canonicalHeaders.forEach((header, idx) => {
      const raw = values[idx] ?? ''
      row[header] = raw.trim().replace(/^["']|["']$/g, '').trim()
    })

    rows.push(row)
  }

  return { rows, unknownHeaders }
}

/**
 * Split a CSV line by separator, respecting quoted fields.
 * Handles fields like: "a,b","c" or 'x;y'
 */
function splitRespectingQuotes(line: string, sep: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuote = false
  let quoteChar = ''

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]

    if (inQuote) {
      if (ch === quoteChar) {
        // Escaped quote (doubled)?
        if (line[i + 1] === quoteChar) {
          current += ch
          i++
        } else {
          inQuote = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"' || ch === "'") {
        inQuote = true
        quoteChar = ch
      } else if (ch === sep) {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }

  result.push(current)
  return result
}
