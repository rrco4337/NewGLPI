import { Outlet } from 'react-router-dom'
import './BackOfficeLayout.css'

export const BackOfficeLayout = () => {
  return (
    <div className="back-office-layout">
      <Outlet />
    </div>
  )
}
