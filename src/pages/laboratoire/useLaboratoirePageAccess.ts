import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

/** Permission + loading for the current laboratoire route (aligned with injection/planning pages). */
export function useLaboratoirePageAccess() {
  const { loading: authLoading } = useAuth();
  const { loading: roleLoading, hasRouteAccess } = useUserRole();
  const location = useLocation();
  const canAccess = hasRouteAccess(location.pathname);
  return { authLoading, roleLoading, canAccess };
}
