import { listItems, createItem } from '@/api/glpi'

type ItemEntry = { id: number; name: string; firstname?: string; realname?: string; completename?: string }

// ─── User name helpers ────────────────────────────────────────────────────────

/**
 * Parse "Rakoto Jean" → { realname: "Rakoto", firstname: "Jean" }
 * Malagasy convention: first token = last name (realname), rest = first name.
 * Single-token names (e.g. "Bibliothèque") → realname only.
 */
function parseFullName(fullName: string): { realname: string; firstname: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return { realname: parts[0], firstname: '' }
  return { realname: parts[0], firstname: parts.slice(1).join(' ') }
}

/** "Rakoto Jean" → "rakoto.jean" — safe GLPI login */
function toLogin(fullName: string): string {
  return fullName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 63) // GLPI login max length
}

const DEFAULT_PASSWORD = 'GlpiImport@2026'

/**
 * Caches GLPI dropdown lists and resolves label→ID in O(1).
 * Call preloadAll() once before the import to batch all fetches in parallel.
 */
export class DropdownResolver {
  private cache = new Map<string, Map<string, number>>()

  // ── Preloading ───────────────────────────────────────────────────────────────

  async preloadAll(token?: string) {
    await Promise.all([
      this.load('State', token),
      this.load('Location', token),
      this.load('Manufacturer', token),
      this.load('ComputerModel', token),
      this.load('MonitorModel', token),
    ])
  }

  async loadUsers(token?: string) {
    if (this.cache.has('User')) return
    const users = await listItems('User', '0-9999', token)
    const map = new Map<string, number>()
    for (const u of users as ItemEntry[]) {
      if (!u.id) continue
      const fn = (u.firstname ?? '').trim().toLowerCase()
      const rn = (u.realname ?? '').trim().toLowerCase()
      const login = (u.name ?? '').trim().toLowerCase()
      if (fn && rn) {
        map.set(`${fn} ${rn}`, u.id)
        map.set(`${rn} ${fn}`, u.id)
      }
      if (login) map.set(login, u.id)
    }
    this.cache.set('User', map)
  }

  private async load(type: string, token?: string) {
    if (this.cache.has(type)) return
    const items = await listItems(type, '0-9999', token)
    const map = new Map<string, number>()
    for (const item of items as ItemEntry[]) {
      if (!item.id) continue
      if (item.name) map.set(item.name.toLowerCase().trim(), item.id)
      if (item.completename) map.set(item.completename.toLowerCase().trim(), item.id)
    }
    this.cache.set(type, map)
  }

  // ── Resolution ───────────────────────────────────────────────────────────────

  resolve(type: string, label: string): number | null {
    if (!label.trim()) return null
    const map = this.cache.get(type)
    if (!map) return null
    return map.get(label.toLowerCase().trim()) ?? null
  }

  resolveUser(fullName: string): number | null {
    return this.resolve('User', fullName)
  }

  resolveModel(itemType: 'Computer' | 'Monitor', label: string): number | null {
    const glpiType = itemType === 'Computer' ? 'ComputerModel' : 'MonitorModel'
    return this.resolve(glpiType, label)
  }

  /**
   * Resolve label→ID from cache; create the entry in GLPI if missing.
   * If creation fails (e.g. GLPI duplicate key or validation error), force-reloads
   * the cache for that type and retries the lookup — handles the case where the item
   * exists in GLPI but wasn't fetched during initial preload.
   * Returns null only if both creation and reload-lookup fail.
   */
  async ensureValue(type: string, label: string, token?: string): Promise<number | null> {
    if (!label.trim()) return null
    const existing = this.resolve(type, label)
    if (existing) return existing

    // Some GLPI types are entity-aware and require entities_id to pass validation
    const entityAware = type === 'Location' || type === 'State'
    const input: Record<string, unknown> = { name: label.trim() }
    if (entityAware) {
      input.entities_id = 0
      input.is_recursive = 1
    }

    try {
      const res = await createItem(type, input, token)
      const id: number = Array.isArray(res) ? res[0]?.id : res?.id
      if (!id) throw new Error('No ID returned')
      const map = this.cache.get(type) ?? new Map<string, number>()
      map.set(label.toLowerCase().trim(), id)
      this.cache.set(type, map)
      return id
    } catch {
      // Creation failed — item may already exist but wasn't in the initial cache.
      // Force-reload this type and retry the lookup.
      this.cache.delete(type)
      try {
        await this.load(type, token)
        return this.resolve(type, label)
      } catch {
        return null
      }
    }
  }

  // ── User creation ────────────────────────────────────────────────────────────

  /**
   * For each unique non-empty name in `fullNames`, check if the user already
   * exists in the cache. Create missing users in GLPI in parallel batches of 5.
   *
   * Returns { created, errors } — IDs are added to the User cache automatically
   * so that subsequent resolveUser() calls find them.
   */
  async ensureUsersExist(
    fullNames: string[],
    token?: string,
  ): Promise<{ created: Array<{ name: string; id: number }>; errors: string[] }> {
    // Make sure the user cache is loaded first
    await this.loadUsers(token)

    const unique = [...new Set(fullNames.filter(n => n.trim()))]
    const missing = unique.filter(n => !this.resolveUser(n))

    if (missing.length === 0) return { created: [], errors: [] }

    const created: Array<{ name: string; id: number }> = []
    const errors: string[] = []

    // Build GLPI User input for each missing name
    const toCreate = missing.map(fullName => {
      const { realname, firstname } = parseFullName(fullName)
      const login = toLogin(fullName)
      return { fullName, realname, firstname, login }
    })

    // Create in batches of 5
    const BATCH = 5
    for (let i = 0; i < toCreate.length; i += BATCH) {
      const batch = toCreate.slice(i, i + BATCH)
      await Promise.allSettled(
        batch.map(async ({ fullName, realname, firstname, login }) => {
          try {
            const res = await createItem(
              'User',
              {
                name: login,
                realname,
                firstname,
                is_active: 1,
                password: DEFAULT_PASSWORD,
                password2: DEFAULT_PASSWORD,
              },
              token,
            )
            const id: number = Array.isArray(res) ? res[0]?.id : res?.id
            if (!id) throw new Error('Pas d\'ID retourné')

            // Update cache so resolveUser() works immediately
            const userMap = this.cache.get('User')!
            const fn = firstname.toLowerCase().trim()
            const rn = realname.toLowerCase().trim()
            if (fn && rn) {
              userMap.set(`${fn} ${rn}`, id)
              userMap.set(`${rn} ${fn}`, id)
            }
            userMap.set(fullName.toLowerCase().trim(), id)
            userMap.set(login, id)

            created.push({ name: fullName, id })
          } catch (e: unknown) {
            errors.push(
              `Utilisateur "${fullName}" (login: ${login}): ${e instanceof Error ? e.message : String(e)}`,
            )
          }
        }),
      )
    }

    return { created, errors }
  }
}
