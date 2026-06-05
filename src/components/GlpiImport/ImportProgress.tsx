import type { ProgressUpdate } from '@/lib/import/types'

type Props = {
  progress: ProgressUpdate
}

const STEPS: Array<{ phase: ProgressUpdate['phase']; icon: string; label: string }> = [
  { phase: 'dropdowns', icon: '📋', label: 'Chargement des listes GLPI' },
  { phase: 'users',     icon: '👤', label: 'Création des utilisateurs' },
  { phase: 'assets',    icon: '💻', label: 'Création des actifs' },
  { phase: 'images',    icon: '🖼',  label: 'Upload des images' },
  { phase: 'tickets',   icon: '🎫', label: 'Création des tickets' },
  { phase: 'costs',     icon: '💰', label: 'Enregistrement des coûts' },
  { phase: 'done',      icon: '✅', label: 'Import terminé' },
]

const PHASE_ORDER: Record<ProgressUpdate['phase'], number> = {
  dropdowns: 0, users: 1, assets: 2, images: 3, tickets: 4, costs: 5, rollback: 5, done: 6,
}

export const ImportProgress = ({ progress }: Props) => {
  const currentOrder = PHASE_ORDER[progress.phase] ?? 0
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="import-progress-card">
      <h2>Import en cours…</h2>

      {progress.phase === 'rollback' && (
        <div className="validation-err-banner" style={{ marginBottom: '1rem' }}>
          ⏪ Annulation et rollback en cours…
        </div>
      )}

      <div className="progress-steps">
        {STEPS.map((step, i) => {
          const stepOrder = i
          const isDone = stepOrder < currentOrder
          const isActive = step.phase === progress.phase || (step.phase === 'done' && progress.phase === 'done')

          return (
            <div key={step.phase} className="progress-step">
              <span className="step-icon">
                {isDone ? '✅' : isActive ? step.icon : '⏳'}
              </span>
              <span className={`step-label ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                {step.label}
                {isActive && progress.message && progress.message !== step.label && (
                  <span style={{ fontWeight: 400, color: '#888', marginLeft: '.4rem', fontSize: '.8rem' }}>
                    — {progress.message}
                  </span>
                )}
              </span>
              {isActive && progress.total > 0 && (
                <>
                  <div className="step-bar-wrap">
                    <div className="step-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="step-counter">{progress.current}/{progress.total}</span>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
