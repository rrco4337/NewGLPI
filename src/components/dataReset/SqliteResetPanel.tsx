import { useState, useEffect, useCallback } from 'react'
import { listSqliteTables, resetSqliteTables } from '@/api/sqliteReset'
import type { SqliteTableDto, SqliteTableResetResponse } from '@/api/sqliteReset'
import { ConfirmModal } from '@/components/ConfirmModal/ConfirmModal'

type PanelState = 'loading' | 'idle' | 'confirming' | 'resetting' | 'done' | 'error'

export const SqliteResetPanel = () => {
  const [state, setState] = useState<PanelState>('loading')
  const [tables, setTables] = useState<SqliteTableDto[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [result, setResult] = useState<SqliteTableResetResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const fetchTables = useCallback(async () => {
    setState('loading')
    try {
      const data = await listSqliteTables()
      setTables(data)
      setSelected(data.map(t => t.name))
      setState('idle')
    } catch (err: any) {
      setErrorMsg(err.message || 'Impossible de contacter le backend.')
      setState('error')
    }
  }, [])

  useEffect(() => { fetchTables() }, [fetchTables])

  const toggle = (name: string) =>
    setSelected(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])

  const handleReset = useCallback(async () => {
    setState('resetting')
    try {
      const res = await resetSqliteTables(selected)
      setResult(res)
      setState('done')
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la réinitialisation.')
      setState('error')
    }
  }, [selected])

  const handleBack = () => {
    setResult(null)
    fetchTables()
  }

  if (state === 'loading') {
    return <div className="sqlite-loading">Chargement des tables SQLite...</div>
  }

  if (state === 'error') {
    return (
      <div className="sqlite-error">
        <p><i className="bi bi-x-circle-fill" style={{ marginRight: 6, color: '#ef4444' }} />{errorMsg}</p>
        <button className="new-reset-button" onClick={fetchTables}>Réessayer</button>
      </div>
    )
  }

  if (state === 'resetting') {
    return (
      <div className="progress-section">
        <div className="progress-header">
          <h3>Réinitialisation SQLite en cours...</h3>
        </div>
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: '100%', animation: 'pulse 1.5s infinite' }} />
        </div>
        <p className="progress-label">Suppression des lignes sélectionnées...</p>
      </div>
    )
  }

  if (state === 'done' && result) {
    return (
      <div className="sqlite-result">
        <div className={`sqlite-result-banner ${result.success ? 'success' : 'error'}`}>
          <i className={`bi ${result.success ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`} style={{ marginRight: 7 }} />
          {result.message}
        </div>

        <div className="report-summary">
          <div className="report-stat success">
            <span className="report-stat-value">{result.totalDeleted}</span>
            <span className="report-stat-label">Lignes supprimées</span>
          </div>
          <div className="report-stat info">
            <span className="report-stat-value">{result.resetTables.length}</span>
            <span className="report-stat-label">Tables réinitialisées</span>
          </div>
        </div>

        <div className="report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr><th>Table</th><th>Statut</th></tr>
            </thead>
            <tbody>
              {result.resetTables.map(t => (
                <tr key={t}>
                  <td className="table-name">{t}</td>
                  <td><span className="status-badge ok"><i className="bi bi-check-circle-fill" style={{ marginRight: 4 }} />Vidée</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button className="new-reset-button" onClick={handleBack}>← Nouvelle réinitialisation</button>
      </div>
    )
  }

  return (
    <>
      {tables.length === 0 ? (
        <div className="sqlite-empty">
          <p>Aucune table trouvée dans la base SQLite.</p>
        </div>
      ) : (
        <>
          <div className="type-selector">
            <div className="type-selector-header">
              <h3>Tables SQLite ({tables.length})</h3>
              <div className="selector-actions">
                <button onClick={() => setSelected(tables.map(t => t.name))} className="link-btn">
                  Tout sélectionner
                </button>
                <span className="separator">|</span>
                <button onClick={() => setSelected([])} className="link-btn">
                  Tout désélectionner
                </button>
              </div>
            </div>

            <div className="sqlite-table-list">
              {tables.map(table => (
                <label key={table.name} className={`sqlite-table-row ${selected.includes(table.name) ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selected.includes(table.name)}
                    onChange={() => toggle(table.name)}
                  />
                  <i className="bi bi-archive-fill chip-icon" />
                  <span className="chip-label">{table.name}</span>
                  <span className="sqlite-row-count">{table.rowCount} ligne{table.rowCount !== 1 ? 's' : ''}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            className="reset-button"
            onClick={() => setState('confirming')}
            disabled={selected.length === 0}
          >
            <i className="bi bi-trash-fill" style={{ marginRight: 6 }} />Vider les tables ({selected.length} sélectionnée{selected.length > 1 ? 's' : ''})
          </button>
        </>
      )}

      {state === 'confirming' && (
        <ConfirmModal
          title="Confirmer la réinitialisation SQLite"
          message={`Toutes les lignes de ${selected.length} table(s) seront supprimées. Action irréversible.`}
          details={selected.map(n => n)}
          confirmText="Oui, vider"
          cancelText="Annuler"
          onConfirm={handleReset}
          onCancel={() => setState('idle')}
        />
      )}
    </>
  )
}
