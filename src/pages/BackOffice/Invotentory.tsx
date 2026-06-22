import { useState } from 'react'
import { useComputerList } from '@/hooks/useComputerList'
import './Invotentory.css'

export const Inventory = () => {
  const { computers, loading, error, refresh } = useComputerList()
  const [search, setSearch] = useState('')

  const filtered = computers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.otherserial?.toLowerCase().includes(search.toLowerCase()) ||
    c.serial?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="inventory-page">

      {/* Header */}
      <div className="inventory-header">
        <div>
          <h1 className="inventory-heading">
            <i className="bi bi-pc-display inventory-heading-icon" />
            Inventaire — Ordinateurs
          </h1>
          <p className="inventory-count">
            {loading ? 'Chargement…' : `${filtered.length} ordinateur${filtered.length !== 1 ? 's' : ''} trouvé${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="inventory-actions">
          <div className="inventory-search-wrap">
            <i className="bi bi-search inventory-search-icon" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un ordinateur…"
              className="inventory-search"
            />
          </div>

          <button onClick={refresh} className="inventory-btn-refresh">
            <i className="bi bi-arrow-clockwise" />
            Actualiser
          </button>

          <button className="inventory-btn-export">
            <i className="bi bi-download" />
            Exporter
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="inventory-error">
          <i className="bi bi-exclamation-circle-fill inventory-error-icon" />
          Erreur : {error}
        </div>
      )}

      {/* Table card */}
      <div className="inventory-table-card">

        {/* Loading skeleton */}
        {loading && (
          <div className="inventory-skeleton">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="inventory-skeleton-row" style={{ opacity: 1 - i * 0.12 }} />
            ))}
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          <div className="inventory-table-scroll">
            <table className="inventory-table">
              <thead>
                <tr>
                  {['#', 'Nom', 'Asset Tag', 'N° de série', 'Statut'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="inventory-empty">
                      <i className="bi bi-inbox" />
                      Aucun ordinateur trouvé
                    </td>
                  </tr>
                )}
                {filtered.map((c, idx) => (
                  <tr key={c.id} className="inventory-tr">
                    <td className="inventory-td-num">{idx + 1}</td>
                    <td className="inventory-td">
                      <div className="inventory-name-cell">
                        <div className="inventory-pc-icon">
                          <i className="bi bi-pc-display-horizontal" />
                        </div>
                        <span className="inventory-name">{c.name}</span>
                      </div>
                    </td>
                    <td className="inventory-td">
                      <span className="inventory-asset-badge">{c.otherserial || '—'}</span>
                    </td>
                    <td className="inventory-serial">{c.serial || '—'}</td>
                    <td className="inventory-td">
                      <span className="inventory-status-badge">En service</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
