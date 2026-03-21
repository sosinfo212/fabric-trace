import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, LogOut, Menu } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { menuConfig, MenuSection } from '@/config/menuConfig';
import { ROLE_LABELS } from '@/types/roles';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { role, hasMenuAccess } = useUserRole();
  const [openSections, setOpenSections] = useState<string[]>([]);

  const toggleSection = (title: string) => {
    setOpenSections((prev) =>
      prev.includes(title)
        ? prev.filter((t) => t !== title)
        : [...prev, title]
    );
  };

  const isActive = (path: string) => location.pathname === path;

  // Sidebar is fully driven by permissions from DB (Administration → Permissions)
  const filteredSections = menuConfig
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => hasMenuAccess(item.url)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <Sidebar className={cn(collapsed ? 'w-14' : 'w-64')} collapsible="icon">
      <SidebarHeader className="border-b border-border p-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">FT</span>
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm">Fab Track</span>
              {role && (
                <span className="text-xs text-muted-foreground">
                  {ROLE_LABELS[role]}
                </span>
              )}
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">FT</span>
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {filteredSections.map((section) => {
          const isOpen = openSections.includes(section.title);
          const hasActiveItem = section.items.some((item) =>
            isActive(item.url)
          );

          return (
            <SidebarGroup key={section.title} className="mb-2">
              <Collapsible
                open={isOpen || hasActiveItem}
                onOpenChange={() => toggleSection(section.title)}
              >
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel
                    className={cn(
                      'flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-md px-2 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground',
                      hasActiveItem && 'text-primary'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <section.icon className="h-4 w-4" />
                      {!collapsed && <span>{section.title}</span>}
                    </div>
                    {!collapsed && (
                      isOpen || hasActiveItem ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )
                    )}
                  </SidebarGroupLabel>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {section.items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild>
                            <NavLink
                              to={item.url}
                              className={cn(
                                'flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors',
                                'hover:bg-muted/50'
                              )}
                              activeClassName="bg-primary/10 text-primary font-medium"
                            >
                              <item.icon className="h-4 w-4 shrink-0" />
                              {!collapsed && <span>{item.title}</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4">
        {!collapsed && user && (
          <div className="flex flex-col gap-2">
            <div className="text-xs text-muted-foreground truncate">
              {user.email}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="w-full justify-start"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        )}
        {collapsed && (
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
