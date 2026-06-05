import { useState } from 'react'
import { useComputerList } from '@/hooks/useComputerList'

export const Inventory = () => {
  const { computers, loading, error, refresh } = useComputerList()
  const [search, setSearch] = useState('')

  const filtered = computers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.otherserial?.toLowerCase().includes(search.toLowerCase()) ||
    c.serial?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div style={{ padding: '32px', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', letterSpacing: '-.4px', margin: 0 }}>
            <i className="bi bi-pc-display" style={{ marginRight: 10, color: '#4f46e5' }} />
            Inventaire — Ordinateurs
          </h1>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>
            {loading ? 'Chargement…' : `${filtered.length} ordinateur${filtered.length !== 1 ? 's' : ''} trouvé${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <i className="bi bi-search" style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: '#94a3b8', fontSize: 14,
            }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un ordinateur…"
              style={{
                padding: '9px 14px 9px 38px',
                border: '1.5px solid #d0d7e1',
                borderRadius: 10,
                fontSize: 13.5,
                background: '#fff',
                color: '#1e293b',
                outline: 'none',
                width: 240,
              }}
              onFocus={e => { e.target.style.borderColor = '#4f46e5'; e.target.style.boxShadow = '0 0 0 3px rgba(79,70,229,.08)' }}
              onBlur={e => { e.target.style.borderColor = '#d0d7e1'; e.target.style.boxShadow = 'none' }}
            />
          </div>

          <button
            onClick={refresh}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px',
              background: '#fff',
              border: '1.5px solid #d0d7e1',
              borderRadius: 10,
              fontSize: 13.5,
              fontWeight: 600,
              color: '#374151',
              cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f1f4f9' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
          >
            <i className="bi bi-arrow-clockwise" style={{ fontSize: 15 }} />
            Actualiser
          </button>

          <button style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 16px',
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            border: 'none',
            borderRadius: 10,
            fontSize: 13.5,
            fontWeight: 600,
            color: '#fff',
            cursor: 'pointer',
            boxShadow: '0 3px 10px rgba(79,70,229,.3)',
          }}>
            <i className="bi bi-download" style={{ fontSize: 14 }} />
            Exporter
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 10,
          marginBottom: 20,
          color: '#dc2626',
          fontSize: 13.5,
        }}>
          <i className="bi bi-exclamation-circle-fill" style={{ fontSize: 16 }} />
          Erreur : {error}
        </div>
      )}

      {/* Table card */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid #d0d7e1',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,.05)',
      }}>

        {/* Loading skeleton */}
        {loading && (
          <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{
                height: 44, borderRadius: 8,
                background: 'linear-gradient(90deg, #f1f4f9 25%, #ecedf5 50%, #f1f4f9 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.4s infinite',
                opacity: 1 - i * 0.12,
              }} />
            ))}
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['#', 'Nom', 'Asset Tag', 'N° de série', 'Statut'].map(h => (
                    <th key={h} style={{
                      padding: '11px 16px',
                      textAlign: 'left',
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '.06em',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                      <i className="bi bi-inbox" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
                      Aucun ordinateur trouvé
                    </td>
                  </tr>
                )}
                {filtered.map((c, idx) => (
                  <tr
                    key={c.id}
                    style={{ borderBottom: '1px solid #f1f4f9', transition: 'background .1s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fafbff' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 12, fontVariantNumeric: 'tabular-nums', width: 56 }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: '#eef2ff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <i className="bi bi-pc-display-horizontal" style={{ color: '#4f46e5', fontSize: 14 }} />
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 13.5, color: '#1e293b' }}>{c.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: 12.5, color: '#4f46e5', background: '#eef2ff',
                        padding: '3px 8px', borderRadius: 6, fontWeight: 600,
                      }}>
                        {c.otherserial || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                      {c.serial || '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                        background: '#d1fae5', color: '#065f46',
                      }}>
                        En service
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  )
}
