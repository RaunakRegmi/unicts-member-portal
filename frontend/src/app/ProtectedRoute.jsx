import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { FullPageSpinner } from '../components/ui';

// Client-side mirror of the backend's rbacMiddleware — purely for UX; the
// API remains the real enforcement point.
export default function ProtectedRoute({ roles, children }) {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const location = useLocation();

  if (!initialized) return <FullPageSpinner />;
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'MEMBER' ? '/dashboard' : '/admin'} replace />;
  }
  return children;
}
