import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useGlpiStore } from '@/store/glpiStore'

/* Each nav item carries its accent colour for the icon badge */
const NAV = [
  { to: '/admin/dashboard',     icon: 'bi-grid-1x2-fill',          label: 'Tableau de bord', end: true,  color: '#6366f1', bg: 'rgba(99,102,241,.18)'  },
  { to: '/admin/tickets',       icon: 'bi-ticket-detailed-fill',   label: 'Tickets',                     color: '#f97316', bg: 'rgba(249,115,22,.18)'  },
  { to: '/admin/inventory',     icon: 'bi-pc-display',             label: 'Inventaire',                  color: '#10b981', bg: 'rgba(16,185,129,.18)'  },
  { to: '/admin/import',        icon: 'bi-cloud-arrow-up-fill',    label: 'Import GLPI',                 color: '#8b5cf6', bg: 'rgba(139,92,246,.18)'  },
  { to: '/admin/verify-import', icon: 'bi-patch-check-fill',       label: 'Vérif. Import',               color: '#0ea5e9', bg: 'rgba(14,165,233,.18)'  },
  { to: '/admin/users',         icon: 'bi-people-fill',            label: 'Utilisateurs',                color: '#ec4899', bg: 'rgba(236,72,153,.18)'  },
  { to: '/admin/items-cost',    icon: 'bi-currency-dollar',        label: 'Coûts Items',                 color: '#14b8a6', bg: 'rgba(20,184,166,.18)'  },
  { to: '/admin/mvt-import',    icon: 'bi-arrow-left-right',       label: 'Import Mvt',                  color: '#a78bfa', bg: 'rgba(167,139,250,.18)' },
  { to: '/admin/kanban-settings',icon: 'bi-kanban-fill',           label: 'Kanban',                      color: '#f59e0b', bg: 'rgba(245,158,11,.18)'  },
  { to: '/admin/reset',         icon: 'bi-arrow-counterclockwise', label: 'Réinitialisation',            color: '#ef4444', bg: 'rgba(239,68,68,.18)'   },
  { to: '/admin/settings',      icon: 'bi-gear-fill',              label: 'Paramètres',                  color: '#64748b', bg: 'rgba(100,116,139,.18)' },
]

export const DashboardLayout = () => {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const { clearTokens } = useGlpiStore()

  const logout = () => {
    clearTokens()
    navigate('/admin/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100svh', background: 'var(--clr-bg)', fontFamily: 'var(--font-sans)' }}>

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside style={{
        width: collapsed ? 66 : 244,
        transition: 'width .22s cubic-bezier(.4,0,.2,1)',
        background: 'var(--sb-bg)',
        borderRight: '1px solid var(--sb-border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflow: 'hidden',
        zIndex: 30,
      }}>

        {/* Logo row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          padding: collapsed ? '16px 15px' : '16px 18px',
          borderBottom: '1px solid rgba(255,255,255,.06)',
          minHeight: 62,
          flexShrink: 0,
        }}>
          <div style={{
            width: 34, height: 34,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 14px rgba(99,102,241,.45)',
          }}>
            <i className="bi bi-box-seam-fill" style={{ color: '#fff', fontSize: 15 }} />
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14.5, color: '#f8fafc', letterSpacing: '-.25px', lineHeight: 1.1 }}>ITU Project</div>
              <div style={{ fontSize: 10.5, color: '#475569', fontWeight: 500, marginTop: 2 }}>Back Office v1.0</div>
            </div>
          )}
        </div>

        {/* Nav label */}
        {!collapsed && (
          <div style={{
            padding: '14px 18px 5px',
            fontSize: 9.5, fontWeight: 800, color: '#334155',
            letterSpacing: '.1em', textTransform: 'uppercase',
            flexShrink: 0,
          }}>
            Menu
          </div>
        )}

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '4px 9px', overflowY: 'auto', overflowX: 'hidden' }}>
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
                padding: collapsed ? '9px 0' : '8px 10px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 10,
                marginBottom: 2,
                textDecoration: 'none',
                background: isActive ? 'rgba(99,102,241,.14)' : 'transparent',
                color: isActive ? '#a5b4fc' : '#64748b',
                fontWeight: isActive ? 600 : 500,
                fontSize: 13,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                borderLeft: isActive ? '2.5px solid #6366f1' : '2.5px solid transparent',
                transition: 'all .15s ease',
              })}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                if (!el.style.background.includes('rgba(99,102,241,.14)'))
                  el.style.background = 'rgba(255,255,255,.05)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                if (!el.style.background.includes('rgba(99,102,241,.14)'))
                  el.style.background = 'transparent'
              }}
            >
              {/* Coloured icon badge */}
              <div style={{
                width: 28, height: 28,
                borderRadius: 8,
                background: item.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <i className={`bi ${item.icon}`} style={{ fontSize: 13, color: item.color }} />
              </div>
              {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Divider + user card + logout */}
        <div style={{ padding: '8px 9px 12px', borderTop: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
          {!collapsed && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 10,
              background: 'rgba(255,255,255,.04)',
              marginBottom: 4,
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>A</span>
              </div>
              <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Administrateur</div>
                <div style={{ fontSize: 10.5, color: '#475569' }}>Super Admin</div>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            title={collapsed ? 'Se déconnecter' : undefined}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: collapsed ? '9px 0' : '8px 10px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: 10, border: 'none',
              background: 'transparent',
              color: '#f87171',
              cursor: 'pointer', fontWeight: 500, fontSize: 13,
              fontFamily: 'var(--font-sans)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,.12)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'rgba(239,68,68,.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <i className="bi bi-box-arrow-right" style={{ fontSize: 13, color: '#f87171' }} />
            </div>
            {!collapsed && <span>Se déconnecter</span>}
          </button>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>

        {/* Topbar */}
        <header style={{
          height: 58,
          background: 'var(--clr-surface)',
          borderBottom: '1px solid var(--clr-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          position: 'sticky',
          top: 0,
          zIndex: 20,
          gap: 12,
        }}>
          {/* Sidebar toggle */}
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--clr-muted)', fontSize: 19,
              padding: '6px 8px', borderRadius: 8, lineHeight: 1,
              display: 'flex', alignItems: 'center',
              fontFamily: 'var(--font-sans)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--clr-surface-3)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
          >
            <i className={`bi bi-${collapsed ? 'layout-sidebar' : 'layout-sidebar-reverse'}`} />
          </button>

          {/* Search */}
          <div style={{ flex: 1, maxWidth: 360, position: 'relative' }}>
            <i className="bi bi-search" style={{
              position: 'absolute', left: 11, top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--clr-subtle)', fontSize: 13,
              pointerEvents: 'none',
            }} />
            <input
              type="text"
              placeholder="Rechercher…"
              style={{
                width: '100%',
                padding: '7px 12px 7px 33px',
                border: '1.5px solid var(--clr-border)',
                borderRadius: 10,
                fontSize: 13,
                background: 'var(--clr-surface-3)',
                color: 'var(--clr-text)',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                transition: 'border-color .15s, background .15s',
              }}
              onFocus={e => {
                e.target.style.borderColor = 'var(--clr-primary)'
                e.target.style.background = '#fff'
                e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,.1)'
              }}
              onBlur={e => {
                e.target.style.borderColor = 'var(--clr-border)'
                e.target.style.background = 'var(--clr-surface-3)'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Offline indicator */}
            <button style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--clr-muted)', fontSize: 18,
              padding: '6px 8px', borderRadius: 8, lineHeight: 1,
              display: 'flex', alignItems: 'center', position: 'relative',
              fontFamily: 'var(--font-sans)',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--clr-surface-3)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              <i className="bi bi-bell-fill" style={{ fontSize: 16 }} />
              <span style={{
                position: 'absolute', top: 5, right: 5,
                width: 7, height: 7,
                background: 'var(--clr-danger)',
                borderRadius: '50%',
                border: '1.5px solid #fff',
              }} />
            </button>

            <div style={{ width: 1, height: 22, background: 'var(--clr-border)' }} />

            <div style={{
              width: 33, height: 33, borderRadius: '50%',
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(99,102,241,.35)',
            }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>A</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'auto', background: 'var(--clr-bg)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
