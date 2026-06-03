import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { initSession } from '@/api/glpi'
import './Login.css'

export const Login = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await initSession(username, password)
      if (response && response.session_token) {
        // Save the session token to localStorage
        localStorage.setItem('glpi_session_token', response.session_token)
        navigate('/admin/dashboard')
      } else {
        setError('Token de session manquant dans la réponse.')
      }
    } catch (err: any) {
      setError(err.message || 'Identifiants incorrects ou erreur réseau.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>
      
      <div className="glass-card">
        <div className="login-header">
          <h2>Admin Portal</h2>
          <p>Sign in to manage the back office</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <label htmlFor="username">Username</label>
          </div>

          <div className="input-group">
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <label htmlFor="password">Password</label>
          </div>

          <button type="submit" className="login-button" disabled={isLoading}>
            <span>{isLoading ? 'Connecting...' : 'Login'}</span>
            {isLoading && <div className="spinner"></div>}
          </button>
        </form>
      </div>
    </div>
  )
}
