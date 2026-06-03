import type { AsyncState } from '@/types/glpi'

type TopBarProps = {
  apiUrl: string
  hasToken: boolean
  hasAppToken: boolean
  connectionState: AsyncState
  onTestConnection: () => void
}

export function TopBar({
  apiUrl,
  hasToken,
  hasAppToken,
  connectionState,
  onTestConnection,
}: TopBarProps) {
  const canTest = hasToken && hasAppToken && connectionState !== 'loading'

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-dot" aria-hidden="true" />
        <div>
          <p className="brand-eyebrow">GLPI / Inventaire</p>
          <h1>Ajout d'ordinateur</h1>
        </div>
      </div>

      <div className="top-actions">
        <div className="connection" role="status" aria-label="État de la connexion GLPI">
          <div>
            <p className="meta-label">GLPI API</p>
            <p className="meta-value">{apiUrl}</p>
          </div>
          <div>
            <p className="meta-label">Session token</p>
            <p className={`meta-value ${hasToken ? 'ok' : 'warn'}`}>
              {hasToken ? 'chargé' : 'absent'}
            </p>
          </div>
          <div>
            <p className="meta-label">App token</p>
            <p className={`meta-value ${hasAppToken ? 'ok' : 'warn'}`}>
              {hasAppToken ? 'chargé' : 'absent'}
            </p>
          </div>
        </div>

        <div className="top-buttons">
          <button
            className="ghost"
            type="button"
            onClick={onTestConnection}
            disabled={!canTest}
            aria-busy={connectionState === 'loading'}
          >
            {connectionState === 'loading' ? 'Test en cours…' : 'Tester la connexion'}
          </button>
        </div>
      </div>
    </header>
  )
}
