import { useState, useEffect } from 'react';
import { userRoleApi } from '@/lib/api';
import { useAuth } from './useAuth';
import { AppRole } from '@/types/roles';

export const useUserRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [allowedMenuPaths, setAllowedMenuPaths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setAllowedMenuPaths([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;

    const fetchRoleAndPermissions = async () => {
      try {
        const [roleRes, permsRes] = await Promise.all([
          userRoleApi.getRole(),
          userRoleApi.getPermissions(),
        ]);
        if (!cancelled) {
          setRole(roleRes.role as AppRole | null);
          setAllowedMenuPaths(Array.isArray(permsRes.menu_paths) ? permsRes.menu_paths : []);
        }
      } catch (err) {
        console.error('Error fetching user role/permissions:', err);
        if (!cancelled) {
          setRole(null);
          setAllowedMenuPaths([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRoleAndPermissions();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const hasAccess = (allowedRoles: AppRole[]): boolean => {
    if (!role) return false;
    return allowedRoles.includes(role);
  };

  /** Whether the user can see a menu item (sidebar). Fully driven by DB permissions; admin always has access. */
  const hasMenuAccess = (menuPath: string): boolean => {
    if (role === 'admin') return true;
    if (!role) return false;
    return allowedMenuPaths.includes(menuPath);
  };

  /** Whether the user can access a route (exact path or sub-path of an allowed menu path). */
  const hasRouteAccess = (pathname: string): boolean => {
    if (role === 'admin') return true;
    if (!role) return false;
    if (allowedMenuPaths.includes(pathname)) return true;
    return allowedMenuPaths.some((p) => pathname.startsWith(p + '/'));
  };

  const isAdmin = role === 'admin';

  return { role, loading, hasAccess, hasMenuAccess, hasRouteAccess, allowedMenuPaths, isAdmin };
};
