import type { RawRow } from './csvParser'
import type {
  AssetRow, TicketRow, CostRow, ValidationError,
  Csv1ValidationResult, Csv2ValidationResult, Csv3ValidationResult,
  ParsedImage, ImageValidationResult,
} from './types'
import {
  parseDecimal, parseStrictInteger, normalizeDatetime,
  mapTicketType, mapTicketStatus, mapTicketPriority, mapItemType, parseItemsField,
} from './normalizers'

// ─── CSV 1 ────────────────────────────────────────────────────────────────────

const REQUIRED_CSV1 = ['name', 'status', 'item_type', 'inventory_number']

export function validateCsv1(rows: RawRow[]): Csv1ValidationResult {
  const errors: ValidationError[] = []
  const parsed: AssetRow[] = []

  // Check required columns exist
  if (rows.length > 0) {
    const cols = Object.keys(rows[0])
    for (const req of REQUIRED_CSV1) {
      if (!cols.includes(req)) {
        errors.push({ rowIndex: -1, column: req, severity: 'error', message: `Colonne obligatoire manquante : "${req}"` })
      }
    }
  }

  const seenNames = new Set<string>()
  const seenInvNumbers = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const idx = i + 2 // 1-based + header row

    const name = row['name'] ?? ''
    const status = row['status'] ?? ''
    const itemTypeRaw = row['item_type'] ?? ''
    const invNumber = row['inventory_number'] ?? ''

    if (!name.trim()) {
      errors.push({ rowIndex: idx, column: 'name', severity: 'error', message: 'Nom vide' })
    }

    if (!invNumber.trim()) {
      errors.push({ rowIndex: idx, column: 'inventory_number', severity: 'error', message: 'Numéro d\'inventaire vide' })
    }

    if (!status.trim()) {
      errors.push({ rowIndex: idx, column: 'status', severity: 'warning', message: 'Statut vide — sera ignoré' })
    }

    const itemType = mapItemType(itemTypeRaw)
    if (!itemType) {
      errors.push({ rowIndex: idx, column: 'item_type', severity: 'error', message: `Type d'objet invalide : "${itemTypeRaw}" — attendu: Computer, Monitor` })
    }

    if (name && seenNames.has(name.toLowerCase())) {
      errors.push({ rowIndex: idx, column: 'name', severity: 'error', message: `Doublon détecté : "${name}"` })
    }
    if (name) seenNames.add(name.toLowerCase())

    if (invNumber && seenInvNumbers.has(invNumber.toLowerCase())) {
      errors.push({ rowIndex: idx, column: 'inventory_number', severity: 'error', message: `Numéro d'inventaire en doublon : "${invNumber}"` })
    }
    if (invNumber) seenInvNumbers.add(invNumber.toLowerCase())

    if (!name.trim() || !itemType) continue

    parsed.push({
      rowIndex: idx,
      name: name.trim(),
      status: status.trim(),
      location: (row['location'] ?? '').trim(),
      manufacturer: (row['manufacturer'] ?? '').trim(),
      itemType,
      model: (row['model'] ?? '').trim(),
      inventoryNumber: invNumber.trim(),
      user: (row['user'] ?? '').trim(),
    })
  }

  const hasHardErrors = errors.some(e => e.severity === 'error')
  return { parsed, errors, hasHardErrors }
}

// ─── CSV 2 ────────────────────────────────────────────────────────────────────

const REQUIRED_CSV2 = ['ref_ticket', 'date', 'heure', 'titre']

export function validateCsv2(rows: RawRow[]): Csv2ValidationResult {
  const errors: ValidationError[] = []
  const parsed: TicketRow[] = []

  if (rows.length > 0) {
    const cols = Object.keys(rows[0])
    for (const req of REQUIRED_CSV2) {
      if (!cols.includes(req)) {
        errors.push({ rowIndex: -1, column: req, severity: 'error', message: `Colonne obligatoire manquante : "${req}"` })
      }
    }
  }

  const seenRefs = new Set<number>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const idx = i + 2

    const refRaw = row['ref_ticket'] ?? ''
    const dateRaw = row['date'] ?? ''
    const heureRaw = row['heure'] ?? ''
    const titre = (row['titre'] ?? '').trim()

    const refTicket = parseStrictInteger(refRaw)
    if (refTicket === null) {
      errors.push({ rowIndex: idx, column: 'ref_ticket', severity: 'error', message: `Ref_Ticket invalide : "${refRaw}" — doit être un entier` })
    } else if (refTicket <= 0) {
      errors.push({ rowIndex: idx, column: 'ref_ticket', severity: 'error', message: `Ref_Ticket doit être > 0, reçu : ${refTicket}` })
    } else if (seenRefs.has(refTicket)) {
      errors.push({ rowIndex: idx, column: 'ref_ticket', severity: 'error', message: `Doublon Ref_Ticket : ${refTicket}` })
    }
    if (refTicket && refTicket > 0) seenRefs.add(refTicket)

    const datetime = normalizeDatetime(dateRaw, heureRaw)
    if (!datetime) {
      errors.push({ rowIndex: idx, column: 'date/heure', severity: 'error', message: `Date/heure non reconnu : "${dateRaw} ${heureRaw}"` })
    }

    if (!titre) {
      errors.push({ rowIndex: idx, column: 'titre', severity: 'error', message: 'Titre vide' })
    }

    if (refTicket === null || !datetime || !titre) continue

    parsed.push({
      rowIndex: idx,
      refTicket,
      date: datetime,
      type: mapTicketType(row['type'] ?? ''),
      title: titre,
      description: (row['description'] ?? '').trim(),
      status: mapTicketStatus(row['status'] ?? ''),
      priority: mapTicketPriority(row['priority'] ?? ''),
      items: parseItemsField(row['items'] ?? ''),
    })
  }

  const hasHardErrors = errors.some(e => e.severity === 'error')
  return { parsed, errors, hasHardErrors }
}

// ─── CSV 3 ────────────────────────────────────────────────────────────────────

const REQUIRED_CSV3 = ['num_ticket']

export function validateCsv3(
  rows: RawRow[],
  validTicketRefs: Set<number>,
): Csv3ValidationResult {
  const errors: ValidationError[] = []
  const parsed: CostRow[] = []

  if (rows.length > 0) {
    const cols = Object.keys(rows[0])
    for (const req of REQUIRED_CSV3) {
      if (!cols.includes(req)) {
        errors.push({ rowIndex: -1, column: req, severity: 'error', message: `Colonne obligatoire manquante : "${req}"` })
      }
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const idx = i + 2

    const numRaw = row['num_ticket'] ?? ''
    const durRaw = row['duration_second'] ?? '0'
    const timeCostRaw = row['time_cost'] ?? '0'
    const fixedRaw = row['fixed_cost'] ?? '0'

    const numTicket = parseStrictInteger(numRaw)
    if (numTicket === null) {
      errors.push({ rowIndex: idx, column: 'num_ticket', severity: 'error', message: `Num_Ticket invalide : "${numRaw}" — entier requis, sans décimale` })
    } else if (!validTicketRefs.has(numTicket)) {
      errors.push({ rowIndex: idx, column: 'num_ticket', severity: 'error', message: `Num_Ticket ${numTicket} ne correspond à aucun Ref_Ticket du CSV 2` })
    }

    const duration = parseStrictInteger(durRaw)
    if (durRaw.trim() && duration === null) {
      errors.push({ rowIndex: idx, column: 'duration_second', severity: 'error', message: `Duration_second invalide : "${durRaw}" — entier requis` })
    }

    const timeCost = parseDecimal(timeCostRaw)
    if (timeCostRaw.trim() && timeCost === null) {
      errors.push({ rowIndex: idx, column: 'time_cost', severity: 'error', message: `Time_Cost invalide : "${timeCostRaw}"` })
    }

    const fixedCost = parseDecimal(fixedRaw)
    if (fixedRaw.trim() && fixedCost === null) {
      errors.push({ rowIndex: idx, column: 'fixed_cost', severity: 'error', message: `Fixed_Cost invalide : "${fixedRaw}"` })
    }

    if (numTicket === null) continue

    parsed.push({
      rowIndex: idx,
      numTicket,
      durationSecond: duration ?? 0,
      timeCost: timeCost ?? 0,
      fixedCost: fixedCost ?? 0,
    })
  }

  const hasHardErrors = errors.some(e => e.severity === 'error')
  return { parsed, errors, hasHardErrors }
}

// ─── Images ──────────────────────────────────────────────────────────────────

const ACCEPTED_IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp'])

export async function validateImages(
  images: ParsedImage[],
  assetNames: Set<string>,
): Promise<ImageValidationResult> {
  const linked: string[] = []
  const orphans: string[] = []
  const duplicates: string[] = []
  const corrupt: string[] = []
  const seenBasenames = new Map<string, number>()

  // Check validity in parallel (batches of 5)
  await Promise.all(
    images.map(async img => {
      if (ACCEPTED_IMAGE_EXTS.has(img.ext.toLowerCase())) {
        try {
          const bmp = await createImageBitmap(img.blob)
          bmp.close()
          img.isValid = true
        } catch {
          img.isValid = false
          corrupt.push(img.filename)
        }
      } else {
        img.isValid = false
        corrupt.push(`${img.filename} (format non supporté)`)
      }
    }),
  )

  for (const img of images) {
    const key = img.basename.toLowerCase()
    if (seenBasenames.has(key)) {
      duplicates.push(img.filename)
    } else {
      seenBasenames.set(key, 1)
    }

    if (!img.isValid) continue

    if (assetNames.has(key)) {
      linked.push(img.basename)
    } else {
      orphans.push(img.basename)
    }
  }

  const missing = [...assetNames].filter(
    n => !seenBasenames.has(n.toLowerCase()),
  )

  return { images, linked, orphans, missing, duplicates, corrupt }
}
