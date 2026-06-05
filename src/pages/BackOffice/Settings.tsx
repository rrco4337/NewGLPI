import { useState, useCallback } from 'react'
import { purgeAllItems, createItem } from '@/api/glpi'
import { ConfirmModal } from '@/components/ConfirmModal/ConfirmModal'
import { ResetReport } from '@/components/ResetReport/ResetReport'
import { CsvImporter } from '@/components/CsvImporter/CsvImporter'
import './Settings.css'

// GLPI item types eligible for purge (test data).
// We intentionally exclude: User, Profile, Entity, Config — these are system data.
const PURGEABLE_ITEM_TYPES = [
  { key: 'Computer', label: 'Ordinateurs', icon: '💻' },
  { key: 'Monitor', label: 'Moniteurs', icon: '🖥️' },
  { key: 'Printer', label: 'Imprimantes', icon: '🖨️' },
  { key: 'NetworkEquipment', label: 'Équipements Réseau', icon: '🌐' },
  { key: 'Phone', label: 'Téléphones', icon: '📱' },
  { key: 'Peripheral', label: 'Périphériques', icon: '🔌' },
  { key: 'Software', label: 'Logiciels', icon: '📦' },
  { key: 'Ticket', label: 'Tickets', icon: '🎫' },
  { key: 'CartridgeItem', label: 'Cartouches', icon: '🖋️' },
  { key: 'ConsumableItem', label: 'Consommables', icon: '📎' },
]

export type ResetResult = {
  itemType: string
  label: string
  deleted: number
  skipped?: number
  errors: string[]
}

export type ImportResult = {
  itemType: string
  label: string
  imported: number
  failed: number
  errors: string[]
}

type SettingsState = 'idle' | 'confirming' | 'resetting' | 'done'

export const Settings = () => {
  const [state, setState] = useState<SettingsState>('idle')
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    PURGEABLE_ITEM_TYPES.map(t => t.key)
  )
  const [resetResults, setResetResults] = useState<ResetResult[]>([])
  const [importResults, setImportResults] = useState<ImportResult[]>([])
  const [progress, setProgress] = useState({ current: 0, total: 0, currentLabel: '' })

  const toggleType = (key: string) => {
    setSelectedTypes(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const selectAll = () => setSelectedTypes(PURGEABLE_ITEM_TYPES.map(t => t.key))
  const selectNone = () => setSelectedTypes([])

  const handleReset = useCallback(async () => {
    setState('resetting')
    const typesToPurge = PURGEABLE_ITEM_TYPES.filter(t => selectedTypes.includes(t.key))
    setProgress({ current: 0, total: typesToPurge.length, currentLabel: '' })
    const results: ResetResult[] = []

    // Log the operation start
    const timestamp = new Date().toISOString()
    console.log(`[ADMIN RESET] Operation started at ${timestamp}`)
    console.log(`[ADMIN RESET] Types selected: ${typesToPurge.map(t => t.key).join(', ')}`)

    for (let i = 0; i < typesToPurge.length; i++) {
      const type = typesToPurge[i]
      setProgress({ current: i + 1, total: typesToPurge.length, currentLabel: type.label })
      const result = await purgeAllItems(type.key)
      results.push({
        itemType: type.key,
        label: type.label,
        deleted: result.deleted,
        errors: result.errors,
      })
      console.log(`[ADMIN RESET] ${type.key}: ${result.deleted} deleted, ${result.errors.length} errors`)
    }

    console.log(`[ADMIN RESET] Operation completed at ${new Date().toISOString()}`)
    setResetResults(results)
    setState('done')
  }, [selectedTypes])

  const handleCsvImport = useCallback(async (
    itemType: string,
    rows: Record<string, unknown>[]
  ) => {
    const typeInfo = PURGEABLE_ITEM_TYPES.find(t => t.key === itemType)
    const label = typeInfo?.label || itemType
    let imported = 0
    let failed = 0
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      try {
        await createItem(itemType, rows[i])
        imported++
      } catch (err: any) {
        failed++
        errors.push(`Ligne ${i + 1}: ${err.message}`)
      }
    }

    const result: ImportResult = { itemType, label, imported, failed, errors }
    setImportResults(prev => [...prev, result])
    console.log(`[ADMIN IMPORT] ${itemType}: ${imported} imported, ${failed} failed`)
    return result
  }, [])

  const handleNewReset = () => {
    setState('idle')
    setResetResults([])
    setImportResults([])
    setProgress({ current: 0, total: 0, currentLabel: '' })
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Paramètres</h1>
        <p>Gestion des données et réinitialisation de l'application</p>
      </div>

      {/* Data Reset Section */}
      <section className="settings-section danger-section">
        <div className="section-header">
          <div className="section-title-group">
            <h2>🗑️ Réinitialisation des données</h2>
            <p className="section-description">
              Supprimez toutes les données de test. Les données système (utilisateurs, rôles, permissions, configuration) seront préservées.
            </p>
          </div>
        </div>

        {state === 'idle' && (
          <>
            <div className="preserve-notice">
              <div className="preserve-icon">🔒</div>
              <div>
                <strong>Données préservées automatiquement :</strong>
                <ul>
                  <li>Utilisateurs administrateurs & profils</li>
                  <li>Rôles et permissions</li>
                  <li>Paramètres de configuration</li>
                  <li>Entités et référentiels système</li>
                </ul>
              </div>
            </div>

            <div className="type-selector">
              <div className="type-selector-header">
                <h3>Tables à réinitialiser</h3>
                <div className="selector-actions">
                  <button onClick={selectAll} className="link-btn">Tout sélectionner</button>
                  <span className="separator">|</span>
                  <button onClick={selectNone} className="link-btn">Tout désélectionner</button>
                </div>
              </div>
              <div className="type-grid">
                {PURGEABLE_ITEM_TYPES.map(type => (
                  <label
                    key={type.key}
                    className={`type-chip ${selectedTypes.includes(type.key) ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(type.key)}
                      onChange={() => toggleType(type.key)}
                    />
                    <span className="chip-icon">{type.icon}</span>
                    <span className="chip-label">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              className="reset-button"
              onClick={() => setState('confirming')}
              disabled={selectedTypes.length === 0}
            >
              <span>🗑️</span> Réinitialiser les données ({selectedTypes.length} tables)
            </button>
          </>
        )}

        {state === 'resetting' && (
          <div className="progress-section">
            <div className="progress-header">
              <h3>Réinitialisation en cours...</h3>
              <span className="progress-counter">
                {progress.current}/{progress.total}
              </span>
            </div>
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <p className="progress-label">
              Suppression : <strong>{progress.currentLabel}</strong>
            </p>
          </div>
        )}

        {state === 'done' && (
          <>
            <ResetReport
              resetResults={resetResults}
              importResults={importResults}
            />

            <div className="post-reset-section">
              <h3>📥 Importer de nouvelles données (CSV)</h3>
              <p className="section-description">
                Vous pouvez maintenant réalimenter les modules en important des fichiers CSV.
              </p>
              <CsvImporter
                itemTypes={PURGEABLE_ITEM_TYPES}
                onImport={handleCsvImport}
              />
            </div>

            <button className="new-reset-button" onClick={handleNewReset}>
              ← Retour aux paramètres
            </button>
          </>
        )}
      </section>

      {/* Confirmation Modal */}
      {state === 'confirming' && (
        <ConfirmModal
          title="⚠️ Confirmation de réinitialisation"
          message={`Vous êtes sur le point de supprimer définitivement toutes les données de ${selectedTypes.length} table(s). Cette action est irréversible.`}
          details={selectedTypes.map(key => {
            const t = PURGEABLE_ITEM_TYPES.find(p => p.key === key)
            return t ? `${t.icon} ${t.label}` : key
          })}
          confirmText="Oui, réinitialiser"
          cancelText="Annuler"
          onConfirm={handleReset}
          onCancel={() => setState('idle')}
        />
      )}
    </div>
  )
}
