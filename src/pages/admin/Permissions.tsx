import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { AppRole } from '@/types/roles';
import { menuConfig } from '@/config/menuConfig';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Key, Loader2, Save, RotateCcw } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface CustomRole {
  id: string;
  name: string;
  label: string;
}

interface Permission {
  role: string;
  menu_path: string;
  can_access: boolean;
}

// Get all menu paths from menuConfig
const getAllMenuPaths = () => {
  const paths: { path: string; title: string; section: string }[] = [];
  menuConfig.forEach((section) => {
    section.items.forEach((item) => {
      paths.push({
        path: item.url,
        title: item.title,
        section: section.title,
      });
    });
  });
  return paths;
};

export default function PermissionsPage() {
  const { user, loading: authLoading } = useAuth();
  const { role, hasAccess, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [localPermissions, setLocalPermissions] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const menuPaths = getAllMenuPaths();

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('custom_roles')
        .select('id, name, label')
        .order('label');

      if (rolesError) throw rolesError;
      setRoles(rolesData || []);

      // Fetch permissions
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('role_permissions')
        .select('role, menu_path, can_access');

      if (permissionsError) throw permissionsError;
      setPermissions(permissionsData || []);

      // Set first role as selected if none selected
      if (!selectedRole && rolesData && rolesData.length > 0) {
        setSelectedRole(rolesData[0].name);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les données',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && role === 'admin') {
      fetchData();
    }
  }, [user, role]);

  // Update local permissions when role changes
  useEffect(() => {
    if (selectedRole) {
      const rolePerms: Record<string, boolean> = {};
      
      // Get default permissions from menuConfig
      menuPaths.forEach((mp) => {
        const menuItem = menuConfig
          .flatMap((s) => s.items)
          .find((i) => i.url === mp.path);
        
        // Default: check if role has access in menuConfig
        const hasDefaultAccess = menuItem?.roles.includes(selectedRole as AppRole) || false;
        rolePerms[mp.path] = hasDefaultAccess;
      });

      // Override with database permissions
      permissions
        .filter((p) => p.role === selectedRole)
        .forEach((p) => {
          rolePerms[p.menu_path] = p.can_access;
        });

      setLocalPermissions(rolePerms);
      setHasChanges(false);
    }
  }, [selectedRole, permissions]);

  const handlePermissionChange = (path: string, checked: boolean) => {
    setLocalPermissions((prev) => ({
      ...prev,
      [path]: checked,
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!selectedRole) return;

    try {
      setSaving(true);

      // Delete existing permissions for this role
      await supabase
        .from('role_permissions')
        .delete()
        .eq('role', selectedRole as AppRole);

      // Insert new permissions
      const permissionsToInsert = Object.entries(localPermissions).map(([path, canAccess]) => ({
        role: selectedRole as AppRole,
        menu_path: path,
        can_access: canAccess,
      }));

      if (permissionsToInsert.length > 0) {
        const { error } = await supabase
          .from('role_permissions')
          .insert(permissionsToInsert);

        if (error) throw error;
      }

      toast({
        title: 'Succès',
        description: 'Permissions enregistrées avec succès',
      });

      setHasChanges(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving permissions:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible d\'enregistrer les permissions',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    // Reset to default permissions from menuConfig
    const rolePerms: Record<string, boolean> = {};
    menuPaths.forEach((mp) => {
      const menuItem = menuConfig
        .flatMap((s) => s.items)
        .find((i) => i.url === mp.path);
      rolePerms[mp.path] = menuItem?.roles.includes(selectedRole as AppRole) || false;
    });
    setLocalPermissions(rolePerms);
    setHasChanges(true);
  };

  const handleSelectAll = () => {
    const newPerms: Record<string, boolean> = {};
    menuPaths.forEach((mp) => {
      newPerms[mp.path] = true;
    });
    setLocalPermissions(newPerms);
    setHasChanges(true);
  };

  const handleDeselectAll = () => {
    const newPerms: Record<string, boolean> = {};
    menuPaths.forEach((mp) => {
      newPerms[mp.path] = false;
    });
    setLocalPermissions(newPerms);
    setHasChanges(true);
  };

  if (authLoading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!hasAccess(['admin'])) {
    return <Navigate to="/" replace />;
  }

  // Group menu paths by section
  const groupedPaths = menuPaths.reduce((acc, mp) => {
    if (!acc[mp.section]) {
      acc[mp.section] = [];
    }
    acc[mp.section].push(mp);
    return acc;
  }, {} as Record<string, typeof menuPaths>);

  const selectedRoleLabel = roles.find((r) => r.name === selectedRole)?.label || selectedRole;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Permissions</h2>
            <p className="text-muted-foreground">
              Configurez l'accès aux menus par rôle
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!selectedRole || saving}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Réinitialiser
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saving}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Enregistrer
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Matrice des Permissions
                </CardTitle>
                <CardDescription>
                  Sélectionnez un rôle et configurez ses accès aux menus
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rôle:</span>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Sélectionner un rôle" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.name} value={r.name}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : selectedRole ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    Tout sélectionner
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                    Tout désélectionner
                  </Button>
                  {hasChanges && (
                    <span className="text-sm text-amber-600">
                      Modifications non enregistrées
                    </span>
                  )}
                </div>

                <ScrollArea className="h-[500px] rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Section</TableHead>
                        <TableHead>Page</TableHead>
                        <TableHead className="w-[100px] text-center">Accès</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(groupedPaths).map(([section, paths]) => (
                        paths.map((mp, index) => (
                          <TableRow key={mp.path}>
                            {index === 0 && (
                              <TableCell 
                                rowSpan={paths.length} 
                                className="font-medium align-top border-r"
                              >
                                {section}
                              </TableCell>
                            )}
                            <TableCell>{mp.title}</TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={localPermissions[mp.path] || false}
                                onCheckedChange={(checked) => 
                                  handlePermissionChange(mp.path, checked as boolean)
                                }
                                disabled={selectedRole === 'admin'}
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      ))}
                    </TableBody>
                  </Table>
                  <ScrollBar orientation="vertical" />
                </ScrollArea>

                {selectedRole === 'admin' && (
                  <p className="text-sm text-muted-foreground italic">
                    Note: Les administrateurs ont toujours accès à toutes les pages.
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Sélectionnez un rôle pour configurer ses permissions
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
