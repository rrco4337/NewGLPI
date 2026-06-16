import { Link } from 'react-router-dom'
import { useEffect, useState, type KeyboardEvent } from 'react'
import { StatusBadge } from '@/components/StatusBadge'
import { useTickets } from '@/hooks/useTickets'
import { getTicketPriorityLabel, getTicketPriorityVariant, getTicketStatusLabel, getTicketStatusVariant } from '@/lib/ticketStatus'
import './Tickets.css'

export const Tickets = () => {
  const {
    tickets,
    loading,
    error,
    query,
    setQuery,
    status,
    setStatus,
    priority,
    setPriority,
    sortKey,
    setSortKey,
    page,
    setPage,
    totalPages,
  } = useTickets()

  const [searchText, setSearchText] = useState(query)

  useEffect(() => {
    setSearchText(query)
  }, [query])

  const applySearch = () => {
    setQuery(searchText)
    setPage(1)
  }

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') applySearch()
  }

  return (
    <section className="tk-page">
      <header className="tk-card">
        <p className="tk-eyebrow">Gestion des tickets</p>
        <h1 className="tk-title">Centre de traitement GLPI</h1>
        <p className="tk-subtitle">Recherchez, filtrez et suivez les tickets avec une vue complète et responsive.</p>
      </header>

      <div className="tk-filters-card">
        <label className="tk-filter-label">
          Recherche
          <div className="tk-search-row">
            <input
              className="tk-input"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Titre, demandeur, technicien..."
            />
            <button type="button" className="tk-btn-search" onClick={applySearch}>
              Rechercher
            </button>
          </div>
        </label>
        <label className="tk-filter-label">
          Statut
          <select className="tk-select" value={status} onChange={(e) => setStatus(e.target.value as 'all' | 'new' | 'in-progress' | 'pending' | 'closed')}>
            <option value="all">Tous</option>
            <option value="new">Nouveau</option>
            <option value="in-progress">In progress</option>
            <option value="pending">En attente</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label className="tk-filter-label">
          Priority
          <select className="tk-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="all">Toutes</option>
            <option value="high">Haute</option>
            <option value="medium">Moyenne</option>
            <option value="low">Basse</option>
          </select>
        </label>
        <label className="tk-filter-label">
          Tri
          <select className="tk-select" value={sortKey} onChange={(e) => setSortKey(e.target.value as 'id' | 'date' | 'priority')}>
            <option value="id">Plus récent</option>
            <option value="date">Date</option>
            <option value="priority">Priorité</option>
          </select>
        </label>
      </div>

      <div className="tk-table-card">
        <div className="tk-table-scroll">
          <table className="tk-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Statut</th>
                <th>Priorité</th>
                <th>Demandeur</th>
                <th>Technicien</th>
                <th>Date</th>
                <th>Catégorie</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="tk-empty-cell">Chargement des tickets…</td></tr>
              )}
              {error && (
                <tr><td colSpan={7} className="tk-error-cell">{error}</td></tr>
              )}
              {!loading && !error && tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    <Link to={`/admin/tickets/${ticket.id}`} className="tk-ticket-link">
                      #{ticket.id} · {ticket.name}
                    </Link>
                    <p className="tk-ticket-hint">Vue détaillée et historique</p>
                  </td>
                  <td><StatusBadge label={getTicketStatusLabel(ticket.status)} variant={getTicketStatusVariant(ticket.status)} /></td>
                  <td><StatusBadge label={getTicketPriorityLabel(ticket.priority)} variant={getTicketPriorityVariant(ticket.priority)} /></td>
                  <td className="tk-td-primary">{ticket.requester_name || 'Non renseigné'}</td>
                  <td className="tk-td-primary">{ticket.technician_name || 'À assigner'}</td>
                  <td className="tk-td-muted">{ticket.date || '—'}</td>
                  <td className="tk-td-muted">{ticket.category || 'Sans catégorie'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="tk-pagination">
          <span>Page {page} sur {totalPages}</span>
          <div className="tk-page-nav">
            <button
              className="tk-page-btn"
              onClick={() => setPage((c) => Math.max(1, c - 1))}
              disabled={page === 1}
            >
              Précédent
            </button>
            <button
              className="tk-page-btn"
              onClick={() => setPage((c) => Math.min(totalPages, c + 1))}
              disabled={page === totalPages}
            >
              Suivant
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
