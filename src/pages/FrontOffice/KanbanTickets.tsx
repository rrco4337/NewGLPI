import { Link } from 'react-router-dom'
import { useTickets } from '@/hooks/useTickets'
import './KanbanTickets.css'

const isNew = (s: string | number) =>
  s === 1 || s === 'new' || s === '1'

const isInProgress = (s: string | number) =>
  [2, 3, 4, 'open', 'pending', '2', '3', '4'].includes(s as never)

const isDone = (s: string | number) =>
  [5, 6, 'solved', 'closed', '5', '6'].includes(s as never)

const COLUMNS = [
  { key: 'new',      label: 'Nouveau',     cls: 'kanban-col-new',      match: isNew },
  { key: 'progress', label: 'In progress', cls: 'kanban-col-progress', match: isInProgress },
  { key: 'done',     label: 'Terminé',     cls: 'kanban-col-done',     match: isDone },
]

export const KanbanTickets = () => {
  const { allTickets, loading, error } = useTickets()

  return (
    <div className="kanban-page">
      <h2 className="kanban-title">Mes tickets</h2>

      {loading && <div className="kanban-loading">Chargement…</div>}
      {error   && <div className="kanban-error">{error}</div>}

      {!loading && (
        <div className="kanban-board">
          {COLUMNS.map(col => {
            const tickets = allTickets.filter(t => col.match(t.status))
            return (
              <div key={col.key} className={`kanban-col ${col.cls}`}>
                <div className="kanban-col-header">
                  <span className="kanban-col-title">{col.label}</span>
                  <span className="kanban-col-count">{tickets.length}</span>
                </div>

                {tickets.length === 0 && (
                  <p className="kanban-empty">Aucun ticket</p>
                )}

                {tickets.map(ticket => (
                  <div key={ticket.id} className="kanban-card">
                    {ticket.name || `Ticket #${ticket.id}`}
                  </div>
                ))}

                {col.key === 'new' && (
                  <Link to="/create-ticket" className="kanban-add-btn">
                    + Ajouter 1 ticket
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
