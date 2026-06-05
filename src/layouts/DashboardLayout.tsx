import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

const NAV = [
  { to: '/admin/dashboard',     icon: 'bi-grid-1x2-fill',       label: 'Tableau de bord', end: true },
  { to: '/admin/tickets',       icon: 'bi-ticket-detailed',      label: 'Tickets' },
  { to: '/admin/inventory',     icon: 'bi-pc-display',           label: 'Inventaire' },
  { to: '/admin/import',        icon: 'bi-cloud-upload-fill',    label: 'Import GLPI' },
  { to: '/admin/verify-import', icon: 'bi-patch-check-fill',     label: 'Vérif. Import' },
  { to: '/admin/users',         icon: 'bi-people-fill',          label: 'Utilisateurs' },
  { to: '/admin/reset',         icon: 'bi-arrow-counterclockwise', label: 'Réinitialisation' },
  { to: '/admin/settings',      icon: 'bi-gear-fill',            label: 'Paramètres' },
]

export const DashboardLayout = () => {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const logout = () => {
    localStorage.removeItem('glpi_session_token')
    navigate('/admin/login')
  }

  return (
    <div className="flex min-h-screen bg-itu-bg font-sans">

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        style={{
          width: collapsed ? 68 : 248,
          transition: 'width .25s cubic-bezier(.4,0,.2,1)',
          background: '#ffffff',
          borderRight: '1px solid #d0d7e1',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'hidden',
          zIndex: 20,
        }}
      >
        {/* Logo */}
        <div style={{
          padding: collapsed ? '18px 14px' : '18px 20px',
          borderBottom: '1px solid #f1f4f9',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          minHeight: 64,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(79,70,229,.35)',
          }}>
            <i className="bi bi-box-seam-fill" style={{ color: '#fff', fontSize: 16 }} />
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#1e293b', letterSpacing: '-.3px' }}>ITU Project</div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginTop: 1 }}>Back Office v1.0</div>
            </div>
          )}
        </div>

        {/* Nav section label */}
        {!collapsed && (
          <div style={{ padding: '16px 20px 6px', fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Navigation
          </div>
        )}

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '4px 10px', overflowY: 'auto', overflowX: 'hidden' }}>
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={collapsed ? item.label : undefined}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: collapsed ? '10px 0' : '9px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 9,
                marginBottom: 2,
                textDecoration: 'none',
                background: isActive ? '#eef2ff' : 'transparent',
                color: isActive ? '#4f46e5' : '#64748b',
                fontWeight: isActive ? 600 : 500,
                fontSize: 13.5,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                borderLeft: isActive ? '3px solid #4f46e5' : '3px solid transparent',
              })}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                if (!el.style.background.includes('eef2ff')) el.style.background = '#f1f4f9'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                if (!el.style.background.includes('eef2ff')) el.style.background = 'transparent'
              }}
            >
              <i className={`bi ${item.icon}`} style={{ fontSize: 16, flexShrink: 0, width: 20, textAlign: 'center' }} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom actions */}
        <div style={{ padding: '10px 10px 14px', borderTop: '1px solid #f1f4f9' }}>
          {!collapsed && (
            <div style={{
              margin: '0 2px 8px',
              padding: '10px 12px',
              background: '#f1f4f9',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>A</span>
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, fontSize: 12.5, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Administrateur</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>Super Admin</div>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            title={collapsed ? 'Se déconnecter' : undefined}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: collapsed ? '10px 0' : '9px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: 9,
              border: 'none',
              background: 'transparent',
              color: '#ef4444',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 13.5,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <i className="bi bi-box-arrow-right" style={{ fontSize: 16, flexShrink: 0, width: 20, textAlign: 'center' }} />
            {!collapsed && <span>Se déconnecter</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Topbar */}
        <header style={{
          height: 60,
          background: '#ffffff',
          borderBottom: '1px solid #d0d7e1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          gap: 16,
        }}>
          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#64748b', fontSize: 20, padding: '4px 8px',
              borderRadius: 8, lineHeight: 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f1f4f9' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
          >
            <i className={`bi bi-${collapsed ? 'layout-sidebar' : 'layout-sidebar-reverse'}`} />
          </button>

          {/* Search */}
          <div style={{ flex: 1, maxWidth: 340, position: 'relative' }}>
            <i className="bi bi-search" style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: '#94a3b8', fontSize: 14,
            }} />
            <input
              type="text"
              placeholder="Rechercher..."
              style={{
                width: '100%',
                padding: '7px 12px 7px 36px',
                border: '1.5px solid #d0d7e1',
                borderRadius: 9,
                fontSize: 13.5,
                background: '#f1f4f9',
                color: '#1e293b',
                outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = '#4f46e5'; e.target.style.background = '#fff' }}
              onBlur={e => { e.target.style.borderColor = '#d0d7e1'; e.target.style.background = '#f1f4f9' }}
            />
          </div>

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#64748b', fontSize: 19, padding: '4px 8px',
              borderRadius: 8, lineHeight: 1, position: 'relative',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f1f4f9' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              <i className="bi bi-bell" />
              <span style={{
                position: 'absolute', top: 4, right: 5,
                width: 7, height: 7,
                background: '#ef4444', borderRadius: '50%',
                border: '1.5px solid #fff',
              }} />
            </button>

            <div style={{ width: 1, height: 24, background: '#d0d7e1' }} />

            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(79,70,229,.3)',
            }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>A</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'auto', background: '#f2f5fa' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
