import { Routes, Route, Navigate } from 'react-router-dom'
import { OfflineBanner } from '@/components/OfflineBanner/OfflineBanner'
import { FrontOfficeLayout } from '@/layouts/FrontOfficeLayout'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Home } from '@/pages/FrontOffice/Home'
import { CreateTicket } from '@/pages/FrontOffice/CreateTicket'
import { KanbanTickets } from '@/pages/FrontOffice/KanbanTickets'
import { Login } from '@/pages/BackOffice/Login'
import { Dashboard } from '@/pages/BackOffice/Dashboard'
import { Settings } from '@/pages/BackOffice/Settings'
import { Reset } from '@/pages/BackOffice/Reset'
import { Inventory } from './pages/BackOffice/Invotentory'
import { GlpiImport } from './pages/BackOffice/GlpiImport'
import { ImportVerify } from './pages/BackOffice/ImportVerify'
import { Tickets } from '@/pages/BackOffice/Tickets'
import { TicketDetail } from './pages/BackOffice/TicketDetail'
import ProtectedRoute from './components/Security/ProtectedRoute';
import KanbanSetting from './pages/BackOffice/KanbanSetting'
import { ItemsCostList } from './pages/BackOffice/ItemsCostList'
import { MvtImport } from './pages/BackOffice/MvtImport'

function App() {
  return (
    <>
    <OfflineBanner />
    <Routes>
      <Route path="/" element={<FrontOfficeLayout />}>
        <Route index element={<Home />} />
        <Route path="create-ticket" element={<CreateTicket />} />
        <Route path="kanban" element={<KanbanTickets />} />
      </Route>

      <Route path="/admin/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
      <Route path="/admin" element={<DashboardLayout />}>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="tickets" element={<Tickets />} />
        <Route path="tickets/:id" element={<TicketDetail />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="users" element={<div style={{ padding: '2rem' }}><h2>Users Module</h2><p>Coming soon...</p></div>} />
        <Route path="settings" element={<Settings />} />
        <Route path="reset" element={<Reset />} />
        <Route path="import" element={<GlpiImport />} />
        <Route path="verify-import" element={<ImportVerify />} />
        <Route path="kanban-settings" element={<KanbanSetting />} />
        <Route path="items-cost" element={<ItemsCostList />} />
        <Route path="mvt-import" element={<MvtImport />} />
      </Route>
</Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}

export default App
