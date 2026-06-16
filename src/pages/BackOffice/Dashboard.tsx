import { Link } from 'react-router-dom'
import { StatusBadge } from '@/components/StatusBadge'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import './Dashboard.css'

export const Dashboard = () => {
  const { data, loading, error } = useDashboardMetrics()

  return (
    <section className="db-page">
      <header className="db-card">
        <p className="db-eyebrow">Dashboard principal</p>
        <h1 className="db-title">Vue d'ensemble du parc informatique</h1>
        <p className="db-subtitle">Suivez l'état des équipements, des incidents et des demandes avec un tableau de bord moderne et responsive.</p>
      </header>

      {loading && <div className="db-card db-card-info">Chargement des métriques…</div>}
      {error && <div className="db-card db-card-error">{error}</div>}

      <Link to="/admin/kanban-settings" className="db-btn-primary">Voir parametres Kanban</Link>

      {data && (
        <>
          <div className="db-stats-grid">
            <article className="db-card">
              <p className="db-stat-label">Équipements</p>
              <p className="db-stat-value">{data.totalAssets}</p>
            </article>
            <article className="db-card">
              <p className="db-stat-label">Tickets Total</p>
              <p className="db-stat-value">{data.totalTickets}</p>
              <p className="db-stat-detail">{data.ticketsByStatus.open} ouverts</p>
            </article>
          </div>

          <div className="db-main-grid">
            <article className="db-card">
              <div className="db-card-head">
                <div>
                  <h2 className="db-card-title">Répartition par type</h2>
                  <p className="db-card-subtitle">Vue synthétique du parc informatique</p>
                </div>
                <Link to="/admin/tickets" className="db-btn-primary">Voir les tickets</Link>
              </div>
              <div className="db-assets-grid">
                {data.assetBreakdown.map((item) => (
                  <div key={item.label} className="db-asset-item">
                    <div className="db-asset-row">
                      <span>{item.label}</span>
                      <span className="db-asset-count">{item.value}</span>
                    </div>
                    <div className="db-progress-bg">
                      <div className="db-progress-fill" style={{ width: `${Math.min(100, item.value)}%`, backgroundImage: item.accent }} />
                    </div>
                    <p className="db-asset-detail">{item.detail}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="db-card">
              <h2 className="db-card-title">Tickets par type</h2>
              <div className="db-type-list">
                <div className="db-type-row">
                  <div className="db-type-inner"><span>Incidents</span><strong>{data.ticketsByStatus.incidents}</strong></div>
                </div>
                <div className="db-type-row">
                  <div className="db-type-inner"><span>Demandes</span><strong>{data.ticketsByStatus.requests}</strong></div>
                </div>
              </div>
            </article>
          </div>

          <article className="db-card">
            <h2 className="db-card-title">Tickets récents</h2>
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Titre</th>
                    <th>Statut</th>
                    <th>Priorité</th>
                    <th>Type</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentTickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td className="db-td-main">#{ticket.id} · {ticket.name}</td>
                      <td><StatusBadge label={ticket.statusLabel} variant={ticket.statusVariant} /></td>
                      <td><StatusBadge label={ticket.priorityLabel} variant={ticket.priorityVariant} /></td>
                      <td className="db-td-sub">{ticket.ticketType}</td>
                      <td className="db-td-muted">{ticket.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </>
      )}
    </section>
  )
}
