import { useState, useCallback } from 'react'
import { purgeAllItems, purgeNonAdminUsers } from '@/api/glpi'
import { ConfirmModal } from '@/components/ConfirmModal/ConfirmModal'
import { ResetReport } from '@/components/ResetReport/ResetReport'
import type { ResetResult } from '@/pages/BackOffice/Settings'

const PURGEABLE_ITEM_TYPES = [
  { key: 'Ticket',            label: 'Tickets',              icon: '🎫', weight: 10 },
  { key: 'Problem',           label: 'Problèmes',            icon: '⚠️',  weight: 11 },
  { key: 'Change',            label: 'Changements',          icon: '🔄', weight: 12 },
  { key: 'Computer',          label: 'Ordinateurs',          icon: '💻', weight: 30 },
  { key: 'Monitor',           label: 'Écrans',               icon: '🖥️', weight: 31 },
  { key: 'NetworkEquipment',  label: 'Équipements réseau',   icon: '🌐', weight: 32 },
  { key: 'Peripheral',        label: 'Périphériques',        icon: '🔌', weight: 33 },
  { key: 'Phone',             label: 'Téléphones',           icon: '📱', weight: 34 },
  { key: 'Printer',           label: 'Imprimantes',          icon: '🖨️', weight: 35 },
  { key: 'SoftwareLicense',   label: 'Licences logicielles', icon: '🔑', weight: 40 },
  { key: 'Software',          label: 'Logiciels',            icon: '📦', weight: 41 },
  { key: 'Document',          label: 'Documents',            icon: '📄', weight: 50 },
  { key: 'Contract',          label: 'Contrats',             icon: '📝', weight: 51 },
  { key: 'Supplier',          label: 'Fournisseurs',         icon: '🏢', weight: 52 },
  { key: 'Contact',           label: 'Contacts',             icon: '👤', weight: 53 },
  { key: 'Budget',            label: 'Budgets',              icon: '💰', weight: 54 },
  { key: 'User',             label: 'Utilisateurs (non-admin)', icon: '👤', weight: 60 },
]

type PanelState = 'idle' | 'confirming' | 'resetting' | 'done'

export const GlpiResetPanel = () => {
  const [state, setState] = useState<PanelState>('idle')
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    PURGEABLE_ITEM_TYPES.map(t => t.key)
  )
  const [resetResults, setResetResults] = useState<ResetResult[]>([])
  const [progress, setProgress] = useState({ current: 0, total: 0, currentLabel: '' })

  const toggleType = (key: string) =>
    setSelectedTypes(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])

  const handleReset = useCallback(async () => {
    setState('resetting')
    const typesToPurge = PURGEABLE_ITEM_TYPES
      .filter(t => selectedTypes.includes(t.key))
      .sort((a, b) => a.weight - b.weight)

    setProgress({ current: 0, total: typesToPurge.length, currentLabel: '' })
    const results: ResetResult[] = []

    for (let i = 0; i < typesToPurge.length; i++) {
      const type = typesToPurge[i]
      setProgress({ current: i + 1, total: typesToPurge.length, currentLabel: type.label })
      let result: { deleted: number; skipped?: number; errors: string[] }
      if (type.key === 'User') {
        result = await purgeNonAdminUsers()
      } else {
        result = await purgeAllItems(type.key)
      }
      results.push({ itemType: type.key, label: type.label, deleted: result.deleted, skipped: result.skipped, errors: result.errors })
    }

    setResetResults(results)
    setState('done')
  }, [selectedTypes])

  const handleReset2 = () => {
    setState('idle')
    setResetResults([])
    setProgress({ current: 0, total: 0, currentLabel: '' })
  }

  return (
    <>
      {state === 'idle' && (
        <>
          <div className="preserve-notice">
            <div className="preserve-icon">🔒</div>
            <div>
              <strong>Données préservées :</strong>
              <ul>
                <li>Administrateurs & profils admin</li>
                <li>Rôles, permissions et entités</li>
                <li>Configuration système</li>
              </ul>
            </div>
          </div>

          <div className="type-selector">
            <div className="type-selector-header">
              <h3>Types à purger</h3>
              <div className="selector-actions">
                <button onClick={() => setSelectedTypes(PURGEABLE_ITEM_TYPES.map(t => t.key))} className="link-btn">
                  Tout sélectionner
                </button>
                <span className="separator">|</span>
                <button onClick={() => setSelectedTypes([])} className="link-btn">
                  Tout désélectionner
                </button>
              </div>
            </div>
            <div className="type-grid">
              {PURGEABLE_ITEM_TYPES.map(type => (
                <label key={type.key} className={`type-chip ${selectedTypes.includes(type.key) ? 'selected' : ''}`}>
                  <input type="checkbox" checked={selectedTypes.includes(type.key)} onChange={() => toggleType(type.key)} />
                  <span className="chip-icon">{type.icon}</span>
                  <span className="chip-label">{type.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button className="reset-button" onClick={() => setState('confirming')} disabled={selectedTypes.length === 0}>
            <span>🗑️</span> Réinitialiser ({selectedTypes.length} type{selectedTypes.length > 1 ? 's' : ''})
          </button>
        </>
      )}

      {state === 'resetting' && (
        <div className="progress-section">
          <div className="progress-header">
            <h3>Réinitialisation en cours...</h3>
            <span className="progress-counter">{progress.current}/{progress.total}</span>
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
          </div>
          <p className="progress-label">Suppression : <strong>{progress.currentLabel}</strong></p>
        </div>
      )}

      {state === 'done' && (
        <>
          <ResetReport resetResults={resetResults} importResults={[]} />
          <button className="new-reset-button" onClick={handleReset2}>← Nouvelle réinitialisation</button>
        </>
      )}

      {state === 'confirming' && (
        <ConfirmModal
          title="⚠️ Confirmer la purge GLPI"
          message={`Suppression définitive de ${selectedTypes.length} type(s). Action irréversible.`}
          details={selectedTypes.map(key => {
            const t = PURGEABLE_ITEM_TYPES.find(p => p.key === key)
            return t ? `${t.icon} ${t.label}` : key
          })}
          confirmText="Oui, purger"
          cancelText="Annuler"
          onConfirm={handleReset}
          onCancel={() => setState('idle')}
        />
      )}
    </>
  )
}
