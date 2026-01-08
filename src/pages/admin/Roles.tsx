import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { AppRole, ROLE_LABELS } from '@/types/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Shield, Users, Loader2, Plus, Pencil, Trash2, Lock } from 'lucide-react';

interface CustomRole {
  id: string;
  name: string;
  label: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  user_count?: number;
}

export default function RolesPage() {
  const { user, loading: authLoading } = useAuth();
  const { role, hasAccess, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<CustomRole | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formDescription, setFormDescription] = useState('');

  const fetchRoles = async () => {
    setLoading(true);
    try {
      // Fetch custom roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('custom_roles')
        .select('*')
        .order('is_system', { ascending: false })
        .order('label');

      if (rolesError) throw rolesError;

      // Fetch user counts per role
      const { data: userRoles, error: userRolesError } = await supabase
        .from('user_roles')
        .select('role');

      if (userRolesError) throw userRolesError;

      // Count users per role
      const roleCounts: Record<string, number> = {};
      userRoles?.forEach((ur) => {
        roleCounts[ur.role] = (roleCounts[ur.role] || 0) + 1;
      });

      const rolesWithCounts = rolesData?.map((r) => ({
        ...r,
        user_count: roleCounts[r.name] || 0,
      })) || [];

      setRoles(rolesWithCounts);
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les rôles',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && role === 'admin') {
      fetchRoles();
    }
  }, [user, role]);

  const resetForm = () => {
    setFormName('');
    setFormLabel('');
    setFormDescription('');
  };

  const handleCreate = async () => {
    if (!formName.trim() || !formLabel.trim()) {
      toast({
        title: 'Erreur',
        description: 'Le nom et le libellé sont requis',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase.from('custom_roles').insert({
        name: formName.toLowerCase().replace(/\s+/g, '_'),
        label: formLabel,
        description: formDescription || null,
        is_system: false,
      });

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Rôle créé avec succès',
      });

      setIsCreateOpen(false);
      resetForm();
      fetchRoles();
    } catch (error: any) {
      console.error('Error creating role:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de créer le rôle',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedRole || !formLabel.trim()) {
      toast({
        title: 'Erreur',
        description: 'Le libellé est requis',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('custom_roles')
        .update({
          label: formLabel,
          description: formDescription || null,
        })
        .eq('id', selectedRole.id);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Rôle mis à jour avec succès',
      });

      setIsEditOpen(false);
      setSelectedRole(null);
      resetForm();
      fetchRoles();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de mettre à jour le rôle',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (roleToDelete: CustomRole) => {
    if (roleToDelete.is_system) {
      toast({
        title: 'Erreur',
        description: 'Les rôles système ne peuvent pas être supprimés',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('custom_roles')
        .delete()
        .eq('id', roleToDelete.id);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Rôle supprimé avec succès',
      });

      fetchRoles();
    } catch (error: any) {
      console.error('Error deleting role:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de supprimer le rôle',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (roleToEdit: CustomRole) => {
    setSelectedRole(roleToEdit);
    setFormName(roleToEdit.name);
    setFormLabel(roleToEdit.label);
    setFormDescription(roleToEdit.description || '');
    setIsEditOpen(true);
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

  const systemRoles = roles.filter((r) => r.is_system);
  const customRoles = roles.filter((r) => !r.is_system);
  const totalUsers = roles.reduce((acc, r) => acc + (r.user_count || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Rôles</h2>
            <p className="text-muted-foreground">
              Gérez les rôles système et personnalisés
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau rôle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer un rôle</DialogTitle>
                <DialogDescription>
                  Ajoutez un nouveau rôle personnalisé
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom (identifiant)</Label>
                  <Input
                    id="name"
                    placeholder="chef_atelier"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Utilisé comme identifiant unique (sans espaces)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="label">Libellé</Label>
                  <Input
                    id="label"
                    placeholder="Chef d'Atelier"
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Description du rôle..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleCreate} disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Créer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rôles Système</CardTitle>
              <Lock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{systemRoles.length}</div>
              <p className="text-xs text-muted-foreground">Rôles prédéfinis</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rôles Personnalisés</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customRoles.length}</div>
              <p className="text-xs text-muted-foreground">Rôles créés</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilisateurs</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
              <p className="text-xs text-muted-foreground">Utilisateurs assignés</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Liste des Rôles
            </CardTitle>
            <CardDescription>
              Rôles système et personnalisés
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Libellé</TableHead>
                    <TableHead>Identifiant</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Utilisateurs</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.label}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {r.name}
                        </code>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {r.description || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.is_system ? 'default' : 'secondary'}>
                          {r.is_system ? 'Système' : 'Personnalisé'}
                        </Badge>
                      </TableCell>
                      <TableCell>{r.user_count || 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(r)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!r.is_system && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={r.user_count && r.user_count > 0}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer le rôle ?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Cette action est irréversible. Le rôle "{r.label}" sera définitivement supprimé.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(r)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Supprimer
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          {r.is_system && (
                            <Button variant="ghost" size="icon" disabled>
                              <Lock className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier le rôle</DialogTitle>
              <DialogDescription>
                Modifier les informations du rôle
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editName">Nom (identifiant)</Label>
                <Input
                  id="editName"
                  value={formName}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  L'identifiant ne peut pas être modifié
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editLabel">Libellé</Label>
                <Input
                  id="editLabel"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editDescription">Description</Label>
                <Textarea
                  id="editDescription"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleEdit} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
