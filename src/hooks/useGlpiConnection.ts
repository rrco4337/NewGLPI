import { useState } from 'react'
import { testSession, GLPI_APP_TOKEN, GLPI_BASE_URL } from '@/api/glpi'
import { sessionTokenFromFile } from '@/lib/sessionToken'
import type { AsyncState } from '@/types/glpi'

export function useGlpiConnection() {
  const [connectionState, setConnectionState] = useState<AsyncState>('idle')
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null)

  const hasToken = sessionTokenFromFile.length > 0
  const hasAppToken = GLPI_APP_TOKEN.length > 0
  const apiUrl = `${GLPI_BASE_URL}/apirest.php`

  const testConnection = async () => {
    setConnectionState('loading')
    setConnectionMessage(null)
    try {
      await testSession()
      setConnectionState('success')
      setConnectionMessage('Connexion GLPI OK')
    } catch (error) {
      setConnectionState('error')
      setConnectionMessage(
        error instanceof Error ? error.message : 'Connexion GLPI impossible',
      )
    }
  }

  return { connectionState, connectionMessage, hasToken, hasAppToken, apiUrl, testConnection }
}
