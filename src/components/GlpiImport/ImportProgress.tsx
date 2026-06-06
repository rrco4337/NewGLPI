import type { ProgressUpdate } from '@/lib/import/types'

type Props = {
  progress: ProgressUpdate
}

const STEPS: Array<{ phase: ProgressUpdate['phase']; icon: string; label: string }> = [
  { phase: 'dropdowns', icon: 'bi-list-check',             label: 'Chargement des listes GLPI' },
  { phase: 'users',     icon: 'bi-person-fill',            label: 'Création des utilisateurs' },
  { phase: 'assets',    icon: 'bi-pc-display',             label: 'Création des actifs' },
  { phase: 'images',    icon: 'bi-file-zip-fill',          label: 'Upload des images' },
  { phase: 'tickets',   icon: 'bi-ticket-detailed-fill',   label: 'Création des tickets' },
  { phase: 'costs',     icon: 'bi-currency-euro',          label: 'Enregistrement des coûts' },
  { phase: 'done',      icon: 'bi-check-circle-fill',      label: 'Import terminé' },
]

const PHASE_ORDER: Record<ProgressUpdate['phase'], number> = {
  dropdowns: 0, users: 1, assets: 2, images: 3, tickets: 4, costs: 5, rollback: 5, done: 6,
}

export const ImportProgress = ({ progress }: Props) => {
  const currentOrder  = PHASE_ORDER[progress.phase] ?? 0
  const stepPct       = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
  const overallPct    = Math.round((currentOrder / (STEPS.length - 1)) * 100)
  const currentStep   = STEPS.find(s => s.phase === progress.phase) ?? STEPS[0]

  return (
    <div className="import-progress-card">
      <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', marginBottom: 20 }}>
        <i className="bi bi-cloud-upload-fill" style={{ marginRight: 10, color: '#4f46e5' }} />
        Import en cours…
      </h2>

      {progress.phase === 'rollback' && (
        <div className="validation-err-banner" style={{ marginBottom: 16 }}>
          <i className="bi bi-skip-backward-fill" style={{ marginRight: 8 }} />
          Annulation et rollback en cours…
        </div>
      )}

      {/* ── Overall progress bar ─────────────────────────────────────────── */}
      <div style={{
        background: '#f8fafc', borderRadius: 14, padding: '18px 20px',
        border: '1px solid #e2e8f0', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className={`bi ${currentStep.icon}`} style={{ color: '#4f46e5', fontSize: 16 }} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b' }}>{currentStep.label}</span>
            {progress.message && progress.message !== currentStep.label && (
              <span style={{ fontSize: 12, color: '#94a3b8' }}>— {progress.message}</span>
            )}
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#4f46e5', minWidth: 38, textAlign: 'right' }}>
            {overallPct}%
          </span>
        </div>

        {/* Global bar */}
        <div style={{ background: '#e2e8f0', borderRadius: 8, height: 10, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{
            height: '100%',
            width: `${overallPct}%`,
            background: 'linear-gradient(90deg, #4f46e5, #7c3aed)',
            borderRadius: 8,
            transition: 'width .5s cubic-bezier(.4,0,.2,1)',
          }} />
        </div>

        {/* Per-step bar (only when the phase has granular progress) */}
        {progress.total > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 11.5, color: '#64748b' }}>
                Progression étape : {progress.current} / {progress.total}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#0ea5e9' }}>{stepPct}%</span>
            </div>
            <div style={{ background: '#e0f2fe', borderRadius: 6, height: 6, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${stepPct}%`,
                background: 'linear-gradient(90deg, #0ea5e9, #38bdf8)',
                borderRadius: 6,
                transition: 'width .3s ease',
              }} />
            </div>
          </>
        )}

        <div style={{ marginTop: 10, fontSize: 11.5, color: '#94a3b8' }}>
          Étape {Math.min(currentOrder + 1, STEPS.length)} / {STEPS.length}
        </div>
      </div>

      {/* ── Step list ────────────────────────────────────────────────────── */}
      <div className="progress-steps">
        {STEPS.map((step, i) => {
          const isDone     = i < currentOrder
          const isActive   = step.phase === progress.phase || (step.phase === 'done' && progress.phase === 'done')
          const isPending  = !isDone && !isActive

          return (
            <div key={step.phase} className="progress-step">
              <span className="step-icon" style={{
                color: isDone ? '#10b981' : isActive ? '#4f46e5' : '#cbd5e1',
              }}>
                {isDone
                  ? <i className="bi bi-check-circle-fill" />
                  : isActive
                    ? <i className={`bi ${step.icon}`} />
                    : <i className="bi bi-circle" />
                }
              </span>
              <span className={`step-label ${isActive ? 'active' : ''} ${isDone ? 'done' : ''} ${isPending ? 'pending' : ''}`}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
