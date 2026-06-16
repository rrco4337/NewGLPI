import { useEffect, useState } from 'react'
import { useOffline } from '@/hooks/useOffline'

export const OfflineBanner = () => {
  const isOffline = useOffline()
  const [visible, setVisible] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)
  const [showBack, setShowBack] = useState(false)

  useEffect(() => {
    if (isOffline) {
      setVisible(true)
      setWasOffline(true)
      setShowBack(false)
    } else if (wasOffline) {
      setShowBack(true)
      setVisible(true)
      const t = setTimeout(() => {
        setVisible(false)
        setShowBack(false)
        setWasOffline(false)
      }, 3000)
      return () => clearTimeout(t)
    }
  }, [isOffline, wasOffline])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 18px',
      borderRadius: 12,
      background: showBack ? '#0f172a' : '#1e1b4b',
      border: `1px solid ${showBack ? 'rgba(99,102,241,.4)' : 'rgba(239,68,68,.4)'}`,
      boxShadow: '0 8px 32px rgba(0,0,0,.4)',
      color: '#f8fafc',
      fontSize: 13.5,
      fontWeight: 600,
      fontFamily: 'var(--font-sans)',
      animation: 'slideUpBanner .3s ease-out',
      whiteSpace: 'nowrap',
    }}>
      <i
        className={`bi bi-${showBack ? 'wifi' : 'wifi-off'}`}
        style={{
          fontSize: 16,
          color: showBack ? '#34d399' : '#f87171',
        }}
      />
      <span>
        {showBack
          ? 'Connexion restaurée — mode en ligne'
          : 'Hors ligne — navigation en cache disponible'}
      </span>
      {!showBack && (
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: '#f87171',
          animation: 'offlinePulse 1.5s ease-in-out infinite',
          flexShrink: 0,
        }} />
      )}
      <style>{`
        @keyframes slideUpBanner {
          from { opacity:0; transform: translateX(-50%) translateY(12px); }
          to   { opacity:1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes offlinePulse {
          0%,100% { opacity:1; }
          50%     { opacity:.3; }
        }
      `}</style>
    </div>
  )
}
