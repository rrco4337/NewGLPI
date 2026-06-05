import { useState } from 'react'
import { GlpiResetPanel } from '@/components/dataReset/GlpiResetPanel'
import { SqliteResetPanel } from '@/components/dataReset/SqliteResetPanel'

type Tab = 'glpi' | 'sqlite'

const TABS = [
  { id: 'glpi'   as Tab, icon: 'bi-cloud-fill',    label: 'GLPI',   desc: 'Purger les données GLPI via l\'API REST' },
  { id: 'sqlite' as Tab, icon: 'bi-database-fill', label: 'SQLite', desc: 'Vider les tables de la base locale' },
]

export const Reset = () => {
  const [active, setActive] = useState<Tab>('glpi')

  return (
    <div style={{ padding: '32px', maxWidth: 960, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', letterSpacing: '-.4px', margin: 0 }}>
          <i className="bi bi-arrow-counterclockwise" style={{ marginRight: 10, color: '#ef4444' }} />
          Réinitialisation des données
        </h1>
        <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>
          Purgez les données de test dans GLPI ou videz les tables de la base SQLite.
        </p>
      </div>

      {/* Danger notice */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 20px',
        background: '#fef2f2',
        border: '1.5px solid #fecaca',
        borderRadius: 12,
        marginBottom: 24,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: '#fee2e2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <i className="bi bi-exclamation-triangle-fill" style={{ color: '#ef4444', fontSize: 18 }} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: '#991b1b' }}>Zone de danger — Action irréversible</div>
          <div style={{ fontSize: 12.5, color: '#b91c1c', marginTop: 2 }}>
            Les suppressions sont définitives. Les administrateurs, rôles et configurations système seront préservés.
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 10,
        marginBottom: 24,
        background: '#f1f4f9',
        padding: 6,
        borderRadius: 14,
        width: 'fit-content',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 20px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13.5,
              fontWeight: 600,
              transition: 'all .2s ease',
              background: active === tab.id ? '#fff' : 'transparent',
              color: active === tab.id ? '#1e293b' : '#64748b',
              boxShadow: active === tab.id ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
            }}
          >
            <i className={`bi ${tab.icon}`} style={{
              fontSize: 14,
              color: active === tab.id ? '#ef4444' : '#94a3b8',
            }} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel card */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid #d0d7e1',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,.05)',
      }}>
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #f1f4f9',
          background: '#fafbfc',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <i className={`bi ${TABS.find(t => t.id === active)!.icon}`} style={{ color: '#ef4444', fontSize: 16 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
              {TABS.find(t => t.id === active)!.label}
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {TABS.find(t => t.id === active)!.desc}
            </div>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          {active === 'glpi' ? <GlpiResetPanel /> : <SqliteResetPanel />}
        </div>
      </div>
    </div>
  )
}
