import type { ResetResult, ImportResult } from '@/pages/BackOffice/Settings'
import './ResetReport.css'

type ResetReportProps = {
  resetResults: ResetResult[]
  importResults: ImportResult[]
}

export const ResetReport = ({ resetResults, importResults }: ResetReportProps) => {
  const totalDeleted = resetResults.reduce((sum, r) => sum + r.deleted, 0)
  const totalErrors = resetResults.reduce((sum, r) => sum + r.errors.length, 0)
  const tablesAffected = resetResults.filter(r => r.deleted > 0).length

  const totalImported = importResults.reduce((sum, r) => sum + r.imported, 0)
  const totalImportFailed = importResults.reduce((sum, r) => sum + r.failed, 0)

  return (
    <div className="reset-report">
      <h3>📋 Rapport de réinitialisation</h3>

      {/* Summary Cards */}
      <div className="report-summary">
        <div className="report-stat success">
          <span className="report-stat-value">{totalDeleted}</span>
          <span className="report-stat-label">Enregistrements supprimés</span>
        </div>
        <div className="report-stat info">
          <span className="report-stat-value">{tablesAffected}</span>
          <span className="report-stat-label">Tables concernées</span>
        </div>
        <div className={`report-stat ${totalErrors > 0 ? 'error' : 'neutral'}`}>
          <span className="report-stat-value">{totalErrors}</span>
          <span className="report-stat-label">Erreurs rencontrées</span>
        </div>
      </div>

      {/* Detail Table */}
      <div className="report-table-wrapper">
        <table className="report-table">
          <thead>
            <tr>
              <th>Table</th>
              <th>Supprimés</th>
              <th>Erreurs</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {resetResults.map(r => (
              <tr key={r.itemType}>
                <td className="table-name">{r.label}</td>
                <td className="table-count">
                  {r.deleted}
                  {r.skipped != null && (
                    <span style={{ color: '#888', fontSize: '.8em', marginLeft: '.4rem' }}>
                      ({r.skipped} admin préservé{r.skipped > 1 ? 's' : ''})
                    </span>
                  )}
                </td>
                <td className="table-count">{r.errors.length}</td>
                <td>
                  {r.errors.length === 0 ? (
                    <span className="status-badge ok">✅ OK</span>
                  ) : (
                    <span className="status-badge warn">⚠️ Partiel</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Error Details */}
      {totalErrors > 0 && (
        <details className="error-details">
          <summary>Voir les erreurs ({totalErrors})</summary>
          <ul className="error-list">
            {resetResults.flatMap(r =>
              r.errors.map((err, i) => (
                <li key={`${r.itemType}-${i}`}>
                  <strong>{r.label}:</strong> {err}
                </li>
              ))
            )}
          </ul>
        </details>
      )}

      {/* Import Results */}
      {importResults.length > 0 && (
        <div className="import-report-section">
          <h4>📥 Résultats des imports CSV</h4>
          <div className="report-summary">
            <div className="report-stat success">
              <span className="report-stat-value">{totalImported}</span>
              <span className="report-stat-label">Importés avec succès</span>
            </div>
            <div className={`report-stat ${totalImportFailed > 0 ? 'error' : 'neutral'}`}>
              <span className="report-stat-value">{totalImportFailed}</span>
              <span className="report-stat-label">Échecs d'import</span>
            </div>
          </div>

          <div className="report-table-wrapper">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Importés</th>
                  <th>Échoués</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {importResults.map(r => (
                  <tr key={r.itemType}>
                    <td className="table-name">{r.label}</td>
                    <td className="table-count">{r.imported}</td>
                    <td className="table-count">{r.failed}</td>
                    <td>
                      {r.failed === 0 ? (
                        <span className="status-badge ok">✅ OK</span>
                      ) : (
                        <span className="status-badge warn">⚠️ Partiel</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalImportFailed > 0 && (
            <details className="error-details">
              <summary>Voir les erreurs d'import ({totalImportFailed})</summary>
              <ul className="error-list">
                {importResults.flatMap(r =>
                  r.errors.map((err, i) => (
                    <li key={`import-${r.itemType}-${i}`}>
                      <strong>{r.label}:</strong> {err}
                    </li>
                  ))
                )}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
