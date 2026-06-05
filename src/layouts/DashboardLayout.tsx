import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import './DashboardLayout.css'
import { useGlpiStore } from '@/store/glpiStore'

export const DashboardLayout = () => {
  const navigate = useNavigate()
  const clearTokens = useGlpiStore((state) => state.clearTokens)

  const handleLogout = () => {
    clearTokens()
    navigate('/admin/login')
  }

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>GLPI Admin</h2>
        </div>
        
        <nav className="sidebar-nav">
          <NavLink 
            to="/admin/dashboard" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            end
          >
            <span className="icon">📊</span>
            Overview
          </NavLink>
          <NavLink 
            to="/admin/tickets" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="icon">🎫</span>
            Tickets
          </NavLink>
          <NavLink 
            to="/admin/inventory" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="icon">💻</span>
            Inventory
          </NavLink>
          <NavLink 
            to="/admin/users" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="icon">👥</span>
            Users
          </NavLink>
          <NavLink
            to="/admin/reset"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="icon">🗑️</span>
            Réinitialisation
          </NavLink>
          <NavLink
            to="/admin/settings"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="icon">⚙️</span>
            Settings
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-button">
            <span className="icon">🚪</span>
            Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="search-bar">
            <input type="text" placeholder="Search..." />
          </div>
          <div className="user-profile">
            <div className="avatar">A</div>
            <span>Admin</span>
          </div>
        </header>
        <div className="content-area">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
