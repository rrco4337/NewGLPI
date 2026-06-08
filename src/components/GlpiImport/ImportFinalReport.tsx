import type { ImportReport } from '@/lib/import/types'

type Props = {
  report: ImportReport
  onReset: () => void
}

const STATS = [
  { key: 'users',       label: 'Utilisateurs',      icon: 'bi-person-fill' },
  { key: 'computers',   label: 'Ordinateurs',        icon: 'bi-pc-display' },
  { key: 'monitors',    label: 'Moniteurs',          icon: 'bi-display-fill' },
  { key: 'otherAssets', label: 'Autres équipements', icon: 'bi-hdd-network-fill' },
  { key: 'tickets',     label: 'Tickets',            icon: 'bi-ticket-detailed-fill' },
  { key: 'documents',   label: 'Images',             icon: 'bi-file-zip-fill' },
  { key: 'costs',       label: 'Coûts',              icon: 'bi-currency-euro' },
  { key: 'itemLinks',   label: 'Liens actifs',       icon: 'bi-link-45deg' },
] as const

export const ImportFinalReport = ({ report, onReset }: Props) => {
  const bannerClass = report.rolledBack ? 'rollback' : report.success ? 'success' : 'failure'

  return (
    <div className="import-final-report">
      <h2>Rapport d'import</h2>

      <div className={`result-banner ${bannerClass}`}>
        {report.rolledBack ? (
          <><i className="bi bi-skip-backward-fill" style={{ marginRight: 8 }} />Import annulé — rollback effectué</>
        ) : report.success ? (
          <><i className="bi bi-check-circle-fill" style={{ marginRight: 8 }} />Import réussi avec succès</>
        ) : (
          <><i className="bi bi-x-circle-fill" style={{ marginRight: 8 }} />Import échoué</>
        )}
      </div>

      {!report.rolledBack && (
        <div className="result-stats">
          {STATS.map(({ key, label, icon }) => (
            <div key={key} className="result-stat">
              <span className="result-stat-value">{report.created[key as keyof typeof report.created]}</span>
              <span className="result-stat-label">
                <i className={`bi ${icon}`} style={{ marginRight: 5 }} />
                {label}
              </span>
            </div>
          ))}
        </div>
      )}

      {report.rollbackErrors.length > 0 && (
        <div className="result-errors">
          <h4>
            <i className="bi bi-exclamation-triangle-fill" style={{ marginRight: 6, color: '#f59e0b' }} />
            Erreurs lors du rollback
          </h4>
          <ul className="result-list">
            {report.rollbackErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {report.errors.length > 0 && (
        <div className="result-errors">
          <h4>
            <i className="bi bi-x-circle-fill" style={{ marginRight: 6, color: '#ef4444' }} />
            Erreurs d'import
          </h4>
          <ul className="result-list">
            {report.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {report.imageWarnings.length > 0 && (
        <div className="result-warnings">
          <h4>
            <i className="bi bi-exclamation-triangle-fill" style={{ marginRight: 6, color: '#f59e0b' }} />
            Avertissements
          </h4>
          <ul className="result-list">
            {report.imageWarnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <button className="btn-new-import" onClick={onReset}>
        <i className="bi bi-arrow-left" style={{ marginRight: 6 }} />
        Nouvel import
      </button>
    </div>
  )
}
