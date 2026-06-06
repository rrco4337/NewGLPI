import { Outlet, Link } from 'react-router-dom'
import './FrontOfficeLayout.css'

export const FrontOfficeLayout = () => {
  return (
    <div className="front-office-layout">
      <header className="fo-topbar">
        <Link to="/" className="fo-logo">
          <i className="bi bi-box" />
          <span>NewGLPI</span>
        </Link>
        <div className="fo-nav-actions">
          <Link to="/create-ticket" className="fo-nav-btn primary">
            <i className="bi bi-plus-circle" /> Créer un ticket
          </Link>
          <Link to="/admin/login" className="fo-nav-btn">
            <i className="bi bi-box-arrow-in-right" /> Admin
          </Link>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
