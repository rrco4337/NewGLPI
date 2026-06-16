import { Outlet, Link } from 'react-router-dom'
import './FrontOfficeLayout.css'

export const FrontOfficeLayout = () => {
  return (
    <div className="front-office-layout">
      <header className="fo-topbar">
        <Link to="/" className="fo-logo">
          <div className="fo-logo-icon">
            <i className="bi bi-box-seam-fill" />
          </div>
          <span>ITU Project</span>
        </Link>
        <div className="fo-nav-actions">
          <Link to="/kanban" className="fo-nav-btn">
            <i className="bi bi-kanban-fill" /> Mes tickets
          </Link>
          <Link to="/create-ticket" className="fo-nav-btn primary">
            <i className="bi bi-plus-circle-fill" /> Nouveau ticket
          </Link>
          <Link to="/admin/login" className="fo-nav-btn">
            <i className="bi bi-shield-lock-fill" /> Admin
          </Link>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
