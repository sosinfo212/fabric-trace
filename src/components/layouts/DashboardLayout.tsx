import { ReactNode } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useUserRole } from '@/hooks/useUserRole';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const { hasRouteAccess, isAdmin, loading } = useUserRole();
  const pathname = location.pathname;

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
          <header className="h-14 border-b border-border flex items-center px-4 bg-background">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-lg font-semibold">Fab Track</h1>
          </header>
          <div className="flex-1 p-6 bg-muted/30">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
