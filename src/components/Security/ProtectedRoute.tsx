// components/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
  // Vérifier si l'utilisateur est authentifié
  const isAuthenticated = () => {
    const sessionToken = localStorage.getItem('glpi_session_token');
    return sessionToken !== null && sessionToken !== '';
  };

  if (!isAuthenticated()) {
    // Rediriger vers la page de login si non authentifié
    return <Navigate to="/admin/login" replace />;
  }

  // Sinon, afficher la route demandée
  return <Outlet />;
};

export default ProtectedRoute;