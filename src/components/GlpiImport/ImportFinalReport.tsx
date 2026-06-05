import type { ImportReport } from '@/lib/import/types'

type Props = {
  report: ImportReport
  onReset: () => void
}

export const ImportFinalReport = ({ report, onReset }: Props) => {
  const bannerClass = report.rolledBack
    ? 'rollback'
    : report.success
    ? 'success'
    : 'failure'

  const bannerText = report.rolledBack
    ? '⏪ Import annulé — rollback effectué'
    : report.success
    ? '✅ Import réussi avec succès'
    : '❌ Import échoué'

  return (
    <div className="import-final-report">
      <h2>Rapport d'import</h2>

      <div className={`result-banner ${bannerClass}`}>{bannerText}</div>

      {!report.rolledBack && (
        <div className="result-stats">
          <div className="result-stat">
            <span className="result-stat-value">{report.created.users}</span>
            <span className="result-stat-label">👤 Utilisateurs</span>
          </div>
          <div className="result-stat">
            <span className="result-stat-value">{report.created.computers}</span>
            <span className="result-stat-label">💻 Ordinateurs</span>
          </div>
          <div className="result-stat">
            <span className="result-stat-value">{report.created.monitors}</span>
            <span className="result-stat-label">🖥 Moniteurs</span>
          </div>
          <div className="result-stat">
            <span className="result-stat-value">{report.created.tickets}</span>
            <span className="result-stat-label">🎫 Tickets</span>
          </div>
          <div className="result-stat">
            <span className="result-stat-value">{report.created.documents}</span>
            <span className="result-stat-label">🖼 Images</span>
          </div>
          <div className="result-stat">
            <span className="result-stat-value">{report.created.costs}</span>
            <span className="result-stat-label">💰 Coûts</span>
          </div>
          <div className="result-stat">
            <span className="result-stat-value">{report.created.itemLinks}</span>
            <span className="result-stat-label">🔗 Liens actifs</span>
          </div>
        </div>
      )}

      {report.rollbackErrors.length > 0 && (
        <div className="result-errors">
          <h4>⚠ Erreurs lors du rollback</h4>
          <ul className="result-list">
            {report.rollbackErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {report.errors.length > 0 && (
        <div className="result-errors">
          <h4>❌ Erreurs d'import</h4>
          <ul className="result-list">
            {report.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {report.imageWarnings.length > 0 && (
        <div className="result-warnings">
          <h4>⚠ Avertissements</h4>
          <ul className="result-list">
            {report.imageWarnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <button className="btn-new-import" onClick={onReset}>
        ← Nouvel import
      </button>
    </div>
  )
}
