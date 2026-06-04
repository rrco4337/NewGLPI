import { useState } from 'react'
import { GlpiResetPanel } from '@/components/dataReset/GlpiResetPanel'
import { SqliteResetPanel } from '@/components/dataReset/SqliteResetPanel'
import './Reset.css'

type Tab = 'glpi' | 'sqlite'

export const Reset = () => {
  const [activeTab, setActiveTab] = useState<Tab>('glpi')

  return (
    <div className="reset-page">
      <div className="reset-header">
        <h1>Réinitialisation des données</h1>
        <p>Purgez les données de test dans GLPI ou videz les tables de la base SQLite.</p>
      </div>

      <div className="reset-tabs">
        <button
          className={`reset-tab ${activeTab === 'glpi' ? 'active' : ''}`}
          onClick={() => setActiveTab('glpi')}
        >
          <span>🔄</span> GLPI
        </button>
        <button
          className={`reset-tab ${activeTab === 'sqlite' ? 'active' : ''}`}
          onClick={() => setActiveTab('sqlite')}
        >
          <span>🗃️</span> SQLite
        </button>
      </div>

      <section className="reset-panel danger-section settings-section">
        {activeTab === 'glpi' ? <GlpiResetPanel /> : <SqliteResetPanel />}
      </section>
    </div>
  )
}
