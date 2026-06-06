import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { initSession } from '@/api/glpi'

export const Login = () => {
 
  const [password, setPassword] = useState('glpi')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await initSession(password)
      if (res?.session_token) {
        localStorage.setItem('glpi_session_token', res.session_token)
        navigate('/admin/dashboard')
      } else {
        setError('Token de session manquant dans la réponse.')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Identifiants incorrects ou erreur réseau.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Left brand panel ── */}
      <div style={{
        flex: '0 0 48%',
        background: 'linear-gradient(135deg, #4338ca 0%, #4f46e5 40%, #7c3aed 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 56px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative blobs */}
        <div style={{
          position: 'absolute', top: -80, right: -80,
          width: 320, height: 320, borderRadius: '50%',
          background: 'rgba(255,255,255,.07)',
        }} />
        <div style={{
          position: 'absolute', bottom: -100, left: -60,
          width: 400, height: 400, borderRadius: '50%',
          background: 'rgba(255,255,255,.05)',
        }} />
        <div style={{
          position: 'absolute', top: '40%', right: '10%',
          width: 160, height: 160, borderRadius: '50%',
          background: 'rgba(255,255,255,.04)',
        }} />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(255,255,255,.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,.3)',
            }}>
              <i className="bi bi-box-seam-fill" style={{ color: '#fff', fontSize: 20 }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#fff', letterSpacing: '-.3px' }}>ITU Project</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', fontWeight: 400 }}>Back Office Platform</div>
            </div>
          </div>
        </div>

        {/* Hero text */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{
            fontSize: 40, fontWeight: 800, color: '#fff',
            lineHeight: 1.15, letterSpacing: '-.5px',
            marginBottom: 16,
          }}>
            Gérez votre<br />
            inventaire IT<br />
            <span style={{ color: 'rgba(255,255,255,.7)' }}>simplement.</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,.75)', fontSize: 16, lineHeight: 1.6, maxWidth: 340 }}>
            Importez, suivez et analysez tous vos équipements, tickets et coûts depuis une interface unifiée.
          </p>

          {/* Feature list */}
          <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: 'bi-cloud-upload-fill', text: 'Import CSV & ZIP en un clic' },
              { icon: 'bi-ticket-detailed-fill', text: 'Gestion complète des tickets' },
              { icon: 'bi-graph-up-arrow', text: 'Suivi des coûts en temps réel' },
              { icon: 'bi-shield-lock-fill', text: 'Authentification sécurisée GLPI' },
            ].map(f => (
              <div key={f.icon} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'rgba(255,255,255,.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <i className={`bi ${f.icon}`} style={{ color: '#fff', fontSize: 14 }} />
                </div>
                <span style={{ color: 'rgba(255,255,255,.85)', fontSize: 14, fontWeight: 500 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: 'relative', zIndex: 1, color: 'rgba(255,255,255,.45)', fontSize: 12 }}>
          © {new Date().getFullYear()} ITU Project · Tous droits réservés
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div style={{
        flex: 1,
        background: '#f2f5fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 40px',
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Header */}
          <div style={{ marginBottom: 36 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#4f46e5', marginBottom: 8, letterSpacing: '.03em', textTransform: 'uppercase' }}>
              Bienvenue
            </p>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: '#1e293b', letterSpacing: '-.4px', lineHeight: 1.2 }}>
              Connexion au Back Office
            </h2>
            <p style={{ marginTop: 8, color: '#64748b', fontSize: 14.5 }}>
              Entrez vos identifiants GLPI pour continuer.
            </p>
          </div>

          {/* Error banner */}
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
              <i className="bi bi-exclamation-circle-fill" style={{ fontSize: 16, flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>


            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <i className="bi bi-lock-fill" style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: '#94a3b8', fontSize: 16,
                }} />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    padding: '11px 44px 11px 42px',
                    border: '1.5px solid #d0d7e1',
                    borderRadius: 10,
                    fontSize: 14,
                    background: '#fff',
                    color: '#1e293b',
                    outline: 'none',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#4f46e5'; e.target.style.boxShadow = '0 0 0 3px rgba(79,70,229,.1)' }}
                  onBlur={e => { e.target.style.borderColor = '#d0d7e1'; e.target.style.boxShadow = 'none' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(s => !s)}
                  style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#94a3b8', fontSize: 16, lineHeight: 1, padding: 0,
                  }}
                >
                  <i className={`bi bi-eye${showPwd ? '-slash' : ''}-fill`} />
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 8,
                width: '100%',
                padding: '12px',
                background: loading ? '#c7d2fe' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                boxShadow: loading ? 'none' : '0 4px 15px rgba(79,70,229,.35)',
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: 18, height: 18, border: '2px solid rgba(255,255,255,.4)',
                    borderTopColor: '#fff', borderRadius: '50%',
                    animation: 'spin .7s linear infinite',
                    display: 'inline-block',
                  }} />
                  Connexion...
                </>
              ) : (
                <>
                  <i className="bi bi-box-arrow-in-right" style={{ fontSize: 17 }} />
                  Se connecter
                </>
              )}
            </button>
          </form>

          <p style={{ marginTop: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
            Authentification via l'API REST GLPI
          </p>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
