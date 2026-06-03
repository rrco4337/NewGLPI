import { Routes, Route, Navigate } from 'react-router-dom'
import { FrontOfficeLayout } from '@/layouts/FrontOfficeLayout'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Home } from '@/pages/FrontOffice/Home'
import { Login } from '@/pages/BackOffice/Login'
import { Dashboard } from '@/pages/BackOffice/Dashboard'

function App() {
  return (
    <Routes>
      {/* Front Office Routes */}
      <Route path="/" element={<FrontOfficeLayout />}>
        <Route index element={<Home />} />
      </Route>

      {/* Back Office Auth Route */}
      <Route path="/admin/login" element={<Login />} />

      {/* Back Office Protected Routes with Sidebar */}
      <Route path="/admin" element={<DashboardLayout />}>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="inventory" element={<div style={{padding: '2rem'}}><h2>Inventory Module</h2><p>Coming soon...</p></div>} />
        <Route path="users" element={<div style={{padding: '2rem'}}><h2>Users Module</h2><p>Coming soon...</p></div>} />
        <Route path="settings" element={<div style={{padding: '2rem'}}><h2>Settings Module</h2><p>Coming soon...</p></div>} />
      </Route>
      
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
