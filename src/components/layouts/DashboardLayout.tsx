import { ReactNode, useMemo } from 'react';
import { useLocation, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { useUserRole } from '@/hooks/useUserRole';
import { resolveBackPath } from '@/lib/resolveBackPath';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasRouteAccess, isAdmin, loading } = useUserRole();
  const pathname = location.pathname;
  const showBack = pathname !== '/' && pathname !== '/auth';
  const backTarget = useMemo(() => resolveBackPath(pathname), [pathname]);

  // Route-level enforcement: only allow paths from permissions (or dashboard home)
  if (!loading) {
    const isDashboard = pathname === '/' || pathname === '';
    if (!isAdmin && !isDashboard && !hasRouteAccess(pathname)) {
      return <Navigate to="/" replace />;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-14 border-b border-border flex items-center gap-2 px-4 bg-background">
            <SidebarTrigger className="shrink-0" />
            {showBack ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 -ml-1"
                onClick={() => navigate(backTarget)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
            ) : null}
            <h1 className="text-lg font-semibold truncate min-w-0">Fab Track</h1>
          </header>
          <div className="flex-1 p-6 bg-muted/30">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
