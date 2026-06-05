// ─── Numeric normalization ───────────────────────────────────────────────────

/** Parse a numeric string that may use comma or dot as decimal separator. */
export function parseDecimal(raw: string): number | null {
  if (!raw || raw.trim() === '') return null
  const cleaned = raw.trim().replace(/\s/g, '').replace(',', '.')
  const n = Number(cleaned)
  return isNaN(n) ? null : n
}

/** Parse an integer. Rejects decimals. */
export function parseStrictInteger(raw: string): number | null {
  const n = parseDecimal(raw)
  if (n === null) return null
  if (!Number.isInteger(n)) return null
  return n
}

// ─── Date normalization ───────────────────────────────────────────────────────

const FR_MONTHS: Record<string, number> = {
  janvier: 1, jan: 1,
  février: 2, fevrier: 2, fev: 2, feb: 2,
  mars: 3, mar: 3,
  avril: 4, avr: 4, apr: 4,
  mai: 5, may: 5,
  juin: 6, jun: 6,
  juillet: 7, juil: 7, jul: 7,
  août: 8, aout: 8, aug: 8,
  septembre: 9, sep: 9, sept: 9,
  octobre: 10, oct: 10,
  novembre: 11, nov: 11,
  décembre: 12, decembre: 12, dec: 12,
  // Malagasy
  janoary: 1, febroary: 2, martsa: 3, aprily: 4, mey: 5,
  jona: 6, jolay: 7, aogositra: 8, septambra: 9,
  oktobra: 10, novambra: 11, desambra: 12,
}

/**
 * Attempt to parse a date string in any of the supported formats.
 * Returns { year, month, day } or null.
 */
function parseDate(raw: string): { y: number; m: number; d: number } | null {
  const s = raw.trim()

  // YYYY-MM-DD or YYYY/MM/DD
  let match = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (match) return { y: +match[1], m: +match[2], d: +match[3] }

  // DD/MM/YYYY or DD-MM-YYYY
  match = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (match) return { y: +match[3], m: +match[2], d: +match[1] }

  // "Jun 01 2026" or "01 Jun 2026"
  match = s.match(/^([A-Za-zÀ-ÿ]+)\s+(\d{1,2})\s+(\d{4})$/)
  if (match) {
    const mon = FR_MONTHS[match[1].toLowerCase()]
    if (mon) return { y: +match[3], m: mon, d: +match[2] }
  }
  match = s.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})$/)
  if (match) {
    const mon = FR_MONTHS[match[2].toLowerCase()]
    if (mon) return { y: +match[3], m: mon, d: +match[1] }
  }

  return null
}

/**
 * Attempt to parse a time string in any of the supported formats.
 * Returns { h, min, sec } or null.
 */
function parseTime(raw: string): { h: number; min: number; sec: number } | null {
  const s = raw.trim()

  // 20:30:15 or 8:30:00
  let match = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (match) return { h: +match[1], min: +match[2], sec: +(match[3] ?? 0) }

  // 8h30 / 08h30 / 08h30min
  match = s.match(/^(\d{1,2})h(\d{2})(?:min)?$/i)
  if (match) return { h: +match[1], min: +match[2], sec: 0 }

  // 8h / 08h (no minutes)
  match = s.match(/^(\d{1,2})h$/i)
  if (match) return { h: +match[1], min: 0, sec: 0 }

  // "8 AM" / "8:30 PM"
  match = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i)
  if (match) {
    let h = +match[1]
    const min = +(match[2] ?? 0)
    const ampm = match[3].toUpperCase()
    if (ampm === 'PM' && h < 12) h += 12
    if (ampm === 'AM' && h === 12) h = 0
    return { h, min, sec: 0 }
  }

  return null
}

/** Returns true if the parsed date/time is logically valid. */
function isValidDateTime(y: number, m: number, d: number, h: number, min: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  if (h < 0 || h > 23 || min < 0 || min > 59) return false
  return true
}

/**
 * Normalize a date string and a time string into a GLPI datetime string.
 * Returns `"YYYY-MM-DD HH:MM:SS"` or null if parsing fails.
 */
export function normalizeDatetime(dateRaw: string, timeRaw: string): string | null {
  const datePart = parseDate(dateRaw)
  if (!datePart) return null

  const timePart = parseTime(timeRaw) ?? { h: 0, min: 0, sec: 0 }

  if (!isValidDateTime(datePart.y, datePart.m, datePart.d, timePart.h, timePart.min)) {
    return null
  }

  const pad = (n: number) => String(n).padStart(2, '0')
  return `${datePart.y}-${pad(datePart.m)}-${pad(datePart.d)} ${pad(timePart.h)}:${pad(timePart.min)}:${pad(timePart.sec)}`
}

// ─── Enum mapping ────────────────────────────────────────────────────────────

const TICKET_TYPE_MAP: Record<string, number> = {
  incident: 1, incidents: 1, 'incident it': 1,
  request: 2, demande: 2, 'service request': 2, fangatahana: 2,
  change: 3, changement: 3,
}

const TICKET_STATUS_MAP: Record<string, number> = {
  new: 1, nouveau: 1, vaovao: 1,
  processing: 2, 'en cours': 2, 'in progress': 2, mizotra: 2,
  assigned: 2,
  planned: 3, planifié: 3, 'en attente assignation': 3,
  pending: 4, 'en attente': 4, miandry: 4, waiting: 4,
  solved: 5, résolu: 5, resolu: 5, voahasoavina: 5, resolved: 5,
  closed: 6, fermé: 6, ferme: 6, voakatona: 6, clos: 6,
}

const TICKET_PRIORITY_MAP: Record<string, number> = {
  'very low': 1, 'très bas': 1, 'tres bas': 1, 'ambany be': 1,
  low: 2, bas: 2, ambany: 2, faible: 2,
  medium: 3, moyen: 3, antonony: 3, normal: 3, moyenne: 3,
  high: 4, élevé: 4, eleve: 4, avo: 4, haute: 4, haut: 4,
  'very high': 5, 'très élevé': 5, 'tres eleve': 5, 'avo be': 5, urgent: 5,
  major: 6, majeur: 6, lehibe: 6, critical: 6, critique: 6,
}

const ITEM_TYPE_MAP: Record<string, 'Computer' | 'Monitor'> = {
  computer: 'Computer', computers: 'Computer', ordinateur: 'Computer',
  ordinateurs: 'Computer', pc: 'Computer', poste: 'Computer',
  workstation: 'Computer', laptop: 'Computer', portable: 'Computer',
  monitor: 'Monitor', monitors: 'Monitor', moniteur: 'Monitor',
  moniteurs: 'Monitor', écran: 'Monitor', ecran: 'Monitor',
  screen: 'Monitor', display: 'Monitor',
}

export function mapTicketType(raw: string): number {
  return TICKET_TYPE_MAP[raw.toLowerCase().trim()] ?? 1
}

export function mapTicketStatus(raw: string): number {
  return TICKET_STATUS_MAP[raw.toLowerCase().trim()] ?? 1
}

export function mapTicketPriority(raw: string): number {
  return TICKET_PRIORITY_MAP[raw.toLowerCase().trim()] ?? 3
}

export function mapItemType(raw: string): 'Computer' | 'Monitor' | null {
  return ITEM_TYPE_MAP[raw.toLowerCase().trim()] ?? null
}

/** Parse the `Items` JSON array field from CSV2. */
export function parseItemsField(raw: string): string[] {
  if (!raw || raw.trim() === '') return []
  const s = raw.trim()
  try {
    const parsed = JSON.parse(s)
    if (Array.isArray(parsed)) return parsed.map(v => String(v).trim()).filter(Boolean)
    return [String(parsed).trim()].filter(Boolean)
  } catch {
    // Fallback: comma-separated without JSON quotes
    return s.split(',').map(v => v.trim().replace(/^["']|["']$/g, '').trim()).filter(Boolean)
  }
}
