import { Navigate, Route } from 'react-router-dom'
import { FrontOfficeLayout } from '@/layouts/FrontOfficeLayout'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Home } from '@/pages/FrontOffice/Home'
import { CreateTicket } from '@/pages/FrontOffice/CreateTicket'
import { Login } from '@/pages/BackOffice/Login'
import { Dashboard } from '@/pages/BackOffice/Dashboard'
import { Settings } from '@/pages/BackOffice/Settings'
import { Reset } from '@/pages/BackOffice/Reset'
import { Tickets } from '@/pages/BackOffice/Tickets'
import { TicketDetail } from '@/pages/BackOffice/TicketDetail'

export const appRoutes = (
  <>
    <Route path="/" element={<FrontOfficeLayout />}>
      <Route index element={<Home />} />
      <Route path="create-ticket" element={<CreateTicket />} />
    </Route>
    <Route path="/admin/login" element={<Login />} />
    <Route path="/admin" element={<DashboardLayout />}>
      <Route index element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="tickets" element={<Tickets />} />
      <Route path="tickets/:id" element={<TicketDetail />} />
      <Route path="inventory" element={<div style={{ padding: '2rem' }}><h2>Inventory Module</h2><p>Coming soon...</p></div>} />
      <Route path="users" element={<div style={{ padding: '2rem' }}><h2>Users Module</h2><p>Coming soon...</p></div>} />
      <Route path="settings" element={<Settings />} />
      <Route path="reset" element={<Reset />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </>
)
