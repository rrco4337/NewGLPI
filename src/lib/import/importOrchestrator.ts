import { createItem, updateItem, deleteItems, listItems } from '@/api/glpi'
import { createItemV2, deleteItemV2 } from '@/api/glpiV2'
import { uploadDocumentToGlpi, linkDocumentToItem, ensureImageDocumentTypes } from '@/api/glpiDocuments'
import { DropdownResolver } from './dropdownResolver'
import type {
  AssetRow, TicketRow, CostRow, ParsedImage,
  ImportReport, CreatedRegistry, AssetInfo, ProgressUpdate, GlpiItemType,
} from './types'

// Types whose GLPI REST v1 endpoint is unavailable — routed to v2
const V2_ONLY_TYPES = new Set<GlpiItemType>(['Socket'])

// Maps each supported asset type to its GLPI model dropdown type and field name
const MODEL_GLPI_TYPE: Partial<Record<GlpiItemType, string>> = {
  Computer: 'ComputerModel',
  Monitor: 'MonitorModel',
  Printer: 'PrinterModel',
  NetworkEquipment: 'NetworkEquipmentModel',
  Peripheral: 'PeripheralModel',
  Phone: 'PhoneModel',
  Enclosure: 'EnclosureModel',
  PDU: 'PDUModel',
  Rack: 'RackModel',
  PassiveDCEquipment: 'PassiveDCEquipmentModel',
  Cable: 'CableType',
  Socket: 'SocketModel',
}

const MODEL_FIELD: Partial<Record<GlpiItemType, string>> = {
  Computer: 'computermodels_id',
  Monitor: 'monitormodels_id',
  Printer: 'printermodels_id',
  NetworkEquipment: 'networkequipmentmodels_id',
  Peripheral: 'peripheralmodels_id',
  Phone: 'phonemodels_id',
  Enclosure: 'enclosuremodels_id',
  PDU: 'pdumodels_id',
  Rack: 'rackmodels_id',
  PassiveDCEquipment: 'passivedcequipmentmodels_id',
  Cable: 'cabletypes_id',
  Socket: 'socketmodels_id',
}

type OnProgress = (update: ProgressUpdate) => void

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function runBatch<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<Array<{ ok: true; value: R } | { ok: false; error: Error }>> {
  const results: Array<{ ok: true; value: R } | { ok: false; error: Error }> = []
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size)
    const settled = await Promise.allSettled(batch.map(fn))
    for (const s of settled) {
      if (s.status === 'fulfilled') results.push({ ok: true, value: s.value })
      else results.push({ ok: false, error: s.reason instanceof Error ? s.reason : new Error(String(s.reason)) })
    }
  }
  return results
}

// ─── Rollback ────────────────────────────────────────────────────────────────

async function rollback(registry: CreatedRegistry, token?: string): Promise<string[]> {
  const errors: string[] = []
  const tryDelete = async (type: string, ids: number[]) => {
    if (!ids.length) return
    try {
      if (V2_ONLY_TYPES.has(type as GlpiItemType)) {
        await Promise.all(ids.map(id => deleteItemV2(type, id)))
      } else {
        await deleteItems(type, ids, token)
      }
    } catch (e: unknown) {
      errors.push(`Rollback ${type}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  await tryDelete('TicketCost', registry.ticketCosts.map(c => c.id))
  await tryDelete('Item_Ticket', registry.itemTickets.map(i => i.id))
  await tryDelete('Ticket', registry.tickets.map(t => t.id))
  await tryDelete('Document', registry.documents.map(d => d.id))

  // Delete other asset types grouped by itemtype
  const otherByType = new Map<string, number[]>()
  for (const a of registry.otherAssets) {
    if (!otherByType.has(a.itemtype)) otherByType.set(a.itemtype, [])
    otherByType.get(a.itemtype)!.push(a.id)
  }
  for (const [type, ids] of otherByType) {
    await tryDelete(type, ids)
  }

  await tryDelete('Monitor', registry.monitors.map(m => m.id))
  await tryDelete('Computer', registry.computers.map(c => c.id))

  return errors
}

// ─── Build GLPI input for asset ──────────────────────────────────────────────

async function buildAssetInput(
  row: AssetRow,
  resolver: DropdownResolver,
  warnings: string[],
  token?: string,
): Promise<Record<string, unknown>> {
  const stateId = await resolver.ensureValue('State', row.status, token)
  if (row.status && !stateId) warnings.push(`Statut "${row.status}" non créé (states_id = 0)`)

  const locationId = await resolver.ensureValue('Location', row.location, token)
  if (row.location && !locationId) warnings.push(`Localisation "${row.location}" non créée (locations_id = 0)`)

  const manufacturerId = await resolver.ensureValue('Manufacturer', row.manufacturer, token)
  if (row.manufacturer && !manufacturerId) warnings.push(`Fabricant "${row.manufacturer}" non créé (manufacturers_id = 0)`)

  const modelGlpiType = MODEL_GLPI_TYPE[row.itemType]
  const modelId = modelGlpiType ? await resolver.ensureValue(modelGlpiType, row.model, token) : null
  if (row.model && modelGlpiType && !modelId) warnings.push(`Modèle "${row.model}" non créé pour ${row.itemType}`)

  const modelField = MODEL_FIELD[row.itemType]

  const userId = row.user ? resolver.resolveUser(row.user) : null
  if (row.user && !userId) {
    warnings.push(`Utilisateur "${row.user}" non résolu pour l'actif "${row.name}" — champ users_id ignoré`)
  }

  return {
    name: row.name,
    otherserial: row.inventoryNumber || undefined,
    states_id: stateId ?? 0,
    locations_id: locationId ?? 0,
    manufacturers_id: manufacturerId ?? 0,
    ...(modelField && modelId ? { [modelField]: modelId } : {}),
    ...(userId ? { users_id: userId } : {}),
  }
}

// ─── Main orchestrator ───────────────────────────────────────────────────────

export async function runImport(
  assets: AssetRow[],
  tickets: TicketRow[],
  costs: CostRow[],
  images: ParsedImage[],
  onProgress: OnProgress,
  token?: string,
): Promise<ImportReport> {
  const registry: CreatedRegistry = {
    computers: [], monitors: [], otherAssets: [], tickets: [],
    documents: [], ticketCosts: [], itemTickets: [],
  }
  const warnings: string[] = []
  const errors: string[] = []

  // ── Phase 1: Resolve dropdowns (all parallel) ─────────────────────────────
  onProgress({ phase: 'dropdowns', message: 'Chargement des listes GLPI…', current: 0, total: 1 })
  const resolver = new DropdownResolver()
  try {
    await resolver.preloadAll(token)
  } catch (e: unknown) {
    const msg = `Erreur lors du chargement des listes GLPI: ${e instanceof Error ? e.message : String(e)}`
    errors.push(msg)
    return { success: false, rolledBack: false, rollbackErrors: [], created: { users: 0, computers: 0, monitors: 0, tickets: 0, documents: 0, costs: 0, itemLinks: 0 }, imageWarnings: warnings, errors }
  }
  onProgress({ phase: 'dropdowns', message: 'Listes chargées', current: 1, total: 1 })

  // ── Phase 1.5: Create missing users ──────────────────────────────────────
  let usersCreated = 0
  const uniqueUserNames = [...new Set(assets.map(a => a.user).filter(Boolean))]

  if (uniqueUserNames.length > 0) {
    onProgress({ phase: 'users', message: `Vérification de ${uniqueUserNames.length} utilisateur(s)…`, current: 0, total: uniqueUserNames.length })
    const { created: newUsers, errors: userErrors } = await resolver.ensureUsersExist(uniqueUserNames, token)
    usersCreated = newUsers.length

    if (userErrors.length > 0) {
      // User creation failures are warnings, not hard errors — import continues
      warnings.push(...userErrors.map(e => `⚠ Utilisateur non créé : ${e}`))
    }

    onProgress({ phase: 'users', message: `${newUsers.length} créé(s), ${uniqueUserNames.length - newUsers.length} existant(s)`, current: uniqueUserNames.length, total: uniqueUserNames.length })
  }

  // ── Phase 2: Create assets ────────────────────────────────────────────────
  const assetNameToInfo = new Map<string, AssetInfo>()
  const computers = assets.filter(a => a.itemType === 'Computer')
  const monitors = assets.filter(a => a.itemType === 'Monitor')
  const otherAssets = assets.filter(a => a.itemType !== 'Computer' && a.itemType !== 'Monitor')

  onProgress({ phase: 'assets', message: `Création de ${assets.length} actifs…`, current: 0, total: assets.length })

  let assetDone = 0

  const createAsset = async (row: AssetRow) => {
    const input = await buildAssetInput(row, resolver, warnings, token)
    const res = V2_ONLY_TYPES.has(row.itemType)
      ? await createItemV2(row.itemType, input)
      : await createItem(row.itemType, input, token)
    const id = Array.isArray(res) ? res[0]?.id : res?.id
    if (!id) throw new Error(`Pas d'ID retourné pour l'actif "${row.name}"`)
    return { name: row.name, id: id as number, itemType: row.itemType }
  }

  const computerResults = await runBatch(computers, 5, createAsset)
  for (let i = 0; i < computerResults.length; i++) {
    const r = computerResults[i]
    if (!r.ok) {
      errors.push(`Ordinateur "${computers[i].name}": ${r.error.message}`)
      const rollbackErrors = await rollback(registry, token)
      return { success: false, rolledBack: true, rollbackErrors, created: { users: usersCreated, computers: registry.computers.length, monitors: 0, otherAssets: 0, tickets: 0, documents: 0, costs: 0, itemLinks: 0 }, imageWarnings: warnings, errors }
    }
    registry.computers.push({ name: r.value.name, id: r.value.id })
    assetNameToInfo.set(r.value.name.toLowerCase(), { itemtype: 'Computer', id: r.value.id })
    assetDone++
    onProgress({ phase: 'assets', message: `Actifs créés : ${assetDone}/${assets.length}`, current: assetDone, total: assets.length })
  }

  const monitorResults = await runBatch(monitors, 5, createAsset)
  for (let i = 0; i < monitorResults.length; i++) {
    const r = monitorResults[i]
    if (!r.ok) {
      errors.push(`Moniteur "${monitors[i].name}": ${r.error.message}`)
      const rollbackErrors = await rollback(registry, token)
      return { success: false, rolledBack: true, rollbackErrors, created: { users: usersCreated, computers: registry.computers.length, monitors: registry.monitors.length, otherAssets: 0, tickets: 0, documents: 0, costs: 0, itemLinks: 0 }, imageWarnings: warnings, errors }
    }
    registry.monitors.push({ name: r.value.name, id: r.value.id })
    assetNameToInfo.set(r.value.name.toLowerCase(), { itemtype: 'Monitor', id: r.value.id })
    assetDone++
    onProgress({ phase: 'assets', message: `Actifs créés : ${assetDone}/${assets.length}`, current: assetDone, total: assets.length })
  }

  const otherResults = await runBatch(otherAssets, 5, createAsset)
  for (let i = 0; i < otherResults.length; i++) {
    const r = otherResults[i]
    if (!r.ok) {
      errors.push(`Actif "${otherAssets[i].name}" (${otherAssets[i].itemType}): ${r.error.message}`)
      const rollbackErrors = await rollback(registry, token)
      return { success: false, rolledBack: true, rollbackErrors, created: { users: usersCreated, computers: registry.computers.length, monitors: registry.monitors.length, otherAssets: registry.otherAssets.length, tickets: 0, documents: 0, costs: 0, itemLinks: 0 }, imageWarnings: warnings, errors }
    }
    registry.otherAssets.push({ name: r.value.name, id: r.value.id, itemtype: r.value.itemType })
    assetNameToInfo.set(r.value.name.toLowerCase(), { itemtype: r.value.itemType, id: r.value.id })
    assetDone++
    onProgress({ phase: 'assets', message: `Actifs créés : ${assetDone}/${assets.length}`, current: assetDone, total: assets.length })
  }

  // ── Phase 3: Upload images (best-effort, no rollback on failure) ──────────
  const validImages = images.filter(img => img.isValid && assetNameToInfo.has(img.basename.toLowerCase()))
  onProgress({ phase: 'images', message: `Upload de ${validImages.length} image(s)…`, current: 0, total: validImages.length })

  // Ensure GLPI has the required DocumentTypes (PNG, JPEG, etc.)
  // GLPI silently creates an empty Document record if the type is missing.
  await ensureImageDocumentTypes(token)

  let imgDone = 0
  // Sequential uploads — GLPI's PHP session locking blocks concurrent multipart
  // requests causing temp files to be lost before they can be processed.
  for (const img of validImages) {
    const info = assetNameToInfo.get(img.basename.toLowerCase())!
    try {
      // Step 1: upload the file alone (no item link in the manifest)
      const docId = await uploadDocumentToGlpi(img.basename, img.blob, img.filename, token)
      registry.documents.push({ name: img.basename, id: docId })

      // Step 2: link the document to the asset (separate request)
      try {
        await linkDocumentToItem(docId, info.itemtype, info.id, token)
      } catch (linkErr: unknown) {
        warnings.push(`Image "${img.filename}": document créé (id=${docId}) mais lien échoué — ${linkErr instanceof Error ? linkErr.message : String(linkErr)}`)
      }
    } catch (e: unknown) {
      warnings.push(`Image "${img.filename}": ${e instanceof Error ? e.message : String(e)}`)
    }
    imgDone++
    onProgress({ phase: 'images', message: `Images : ${imgDone}/${validImages.length}`, current: imgDone, total: validImages.length })
  }

  // ── Phase 4: Create tickets ───────────────────────────────────────────────
  onProgress({ phase: 'tickets', message: `Création de ${tickets.length} ticket(s)…`, current: 0, total: tickets.length })
  const refToGlpiId = new Map<number, number>()

  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i]
    // Create with status=1 (New) so GLPI allows linking items.
    // Closed/Resolved tickets reject Item_Ticket creation.
    const input: Record<string, unknown> = {
      name: t.title,
      content: t.description || t.title,
      type: t.type,
      status: 1,
      priority: t.priority,
      date: t.date,
    }

    try {
      const res = await createItem('Ticket', input, token)
      const id = Array.isArray(res) ? res[0]?.id : res?.id
      if (!id) throw new Error('Pas d\'ID retourné')
      const ticketId = id as number
      registry.tickets.push({ ref: t.refTicket, id: ticketId })
      refToGlpiId.set(t.refTicket, ticketId)

      // Link assets to ticket
      for (const assetName of t.items) {
        const info = assetNameToInfo.get(assetName.toLowerCase())
        if (!info) {
          warnings.push(`Ticket ${t.refTicket}: actif "${assetName}" non trouvé — lien ignoré`)
          continue
        }
        try {
          let linkId: number | undefined
          if (V2_ONLY_TYPES.has(info.itemtype)) {
            const linkRes = await createItemV2('Item_Ticket', {
              tickets_id: ticketId,
              itemtype: info.itemtype,
              items_id: info.id,
            }, 'Assistance')
            linkId = linkRes.id
          } else {
            const linkRes = await createItem('Item_Ticket', {
              tickets_id: ticketId,
              itemtype: info.itemtype,
              items_id: info.id,
            }, token)
            linkId = Array.isArray(linkRes) ? linkRes[0]?.id : linkRes?.id
          }
          if (linkId) registry.itemTickets.push({ id: linkId })
        } catch (e: unknown) {
          warnings.push(`Lien ticket ${t.refTicket} ↔ "${assetName}": ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      // Set the final status after all items are linked
      if (t.status !== 1) {
        try {
          await updateItem('Ticket', ticketId, { status: t.status }, token)
        } catch (e: unknown) {
          warnings.push(`Ticket ${t.refTicket}: statut final (${t.status}) non appliqué — ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      onProgress({ phase: 'tickets', message: `Tickets : ${i + 1}/${tickets.length}`, current: i + 1, total: tickets.length })
    } catch (e: unknown) {
      errors.push(`Ticket ${t.refTicket}: ${e instanceof Error ? e.message : String(e)}`)
      const rollbackErrors = await rollback(registry, token)
      return { success: false, rolledBack: true, rollbackErrors, created: { users: usersCreated, computers: registry.computers.length, monitors: registry.monitors.length, otherAssets: registry.otherAssets.length, tickets: registry.tickets.length, documents: registry.documents.length, costs: 0, itemLinks: registry.itemTickets.length }, imageWarnings: warnings, errors }
    }
  }

  // ── Phase 5: Create costs ─────────────────────────────────────────────────
  onProgress({ phase: 'costs', message: `Création des coûts…`, current: 0, total: costs.length })

  for (let i = 0; i < costs.length; i++) {
    const c = costs[i]
    const ticketGlpiId = refToGlpiId.get(c.numTicket)
    if (!ticketGlpiId) {
      warnings.push(`Coût ligne ${c.rowIndex}: ticket ref ${c.numTicket} non trouvé — ignoré`)
      continue
    }

    try {
      // One TicketCost record per CSV row — GLPI fields:
      //   actiontime  = duration in seconds
      //   cost_time   = financial value of time spent
      //   cost_fixed  = flat/fixed cost
      const res = await createItem('TicketCost', {
        tickets_id: ticketGlpiId,
        name: 'Coût d\'intervention',
        actiontime: c.durationSecond,
        cost_time:  c.timeCost,
        cost_fixed: c.fixedCost,
      }, token)
      const id = Array.isArray(res) ? res[0]?.id : res?.id
      if (!id) throw new Error('Pas d\'ID retourné')
      registry.ticketCosts.push({ id: id as number })
    } catch (e: unknown) {
      errors.push(`Coût ticket ${c.numTicket}: ${e instanceof Error ? e.message : String(e)}`)
      const rollbackErrors = await rollback(registry, token)
      return { success: false, rolledBack: true, rollbackErrors, created: { users: usersCreated, computers: registry.computers.length, monitors: registry.monitors.length, otherAssets: registry.otherAssets.length, tickets: registry.tickets.length, documents: registry.documents.length, costs: registry.ticketCosts.length, itemLinks: registry.itemTickets.length }, imageWarnings: warnings, errors }
    }

    onProgress({ phase: 'costs', message: `Coûts : ${i + 1}/${costs.length}`, current: i + 1, total: costs.length })
  }

  onProgress({ phase: 'done', message: 'Import terminé', current: 1, total: 1 })

  return {
    success: true,
    rolledBack: false,
    rollbackErrors: [],
    created: {
      users: usersCreated,
      computers: registry.computers.length,
      monitors: registry.monitors.length,
      otherAssets: registry.otherAssets.length,
      tickets: registry.tickets.length,
      documents: registry.documents.length,
      costs: registry.ticketCosts.length,
      itemLinks: registry.itemTickets.length,
    },
    imageWarnings: warnings,
    errors,
  }
}

// ─── Dry-run: count what would be fetched from GLPI ─────────────────────────

export async function countExistingAssets(token?: string): Promise<{ computers: number; monitors: number }> {
  try {
    const [comps, mons] = await Promise.all([
      listItems('Computer', '0-9999', token),
      listItems('Monitor', '0-9999', token),
    ])
    return { computers: comps.length, monitors: mons.length }
  } catch {
    return { computers: 0, monitors: 0 }
  }
}
