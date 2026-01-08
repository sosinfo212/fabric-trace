import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Link, Loader2, Users } from 'lucide-react';

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
}

interface Chaine {
  id: string;
  num_chaine: number;
  responsable_qlty_id: string | null;
  chef_de_chaine_id: string | null;
  nbr_operateur: number;
  created_at: string;
  responsable_qlty?: Profile;
  chef_de_chaine?: Profile;
}

export default function ChainsPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [chaines, setChaines] = useState<Chaine[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [agentQualiteProfiles, setAgentQualiteProfiles] = useState<Profile[]>([]);
  const [chefDeChaineProfiles, setChefDeChaineProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedChaine, setSelectedChaine] = useState<Chaine | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formNumChaine, setFormNumChaine] = useState('');
  const [formResponsableQlty, setFormResponsableQlty] = useState('');
  const [formChefDeChaine, setFormChefDeChaine] = useState('');
  const [formNbrOperateur, setFormNbrOperateur] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch chaines with related profiles
      const { data: chainesData, error: chainesError } = await supabase
        .from('chaines')
        .select(`
          *,
          responsable_qlty:profiles!chaines_responsable_qlty_id_fkey(id, email, full_name),
          chef_de_chaine:profiles!chaines_chef_de_chaine_id_fkey(id, email, full_name)
        `)
        .order('num_chaine');

      if (chainesError) throw chainesError;

      // Fetch all profiles for dropdowns
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Fetch user roles to filter profiles by role
      const { data: userRolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const allProfiles = profilesData || [];
      const userRoles = userRolesData || [];

      // Filter profiles by role
      const agentQualiteIds = userRoles.filter(r => r.role === 'agent_qualite').map(r => r.user_id);
      const chefDeChaineIds = userRoles.filter(r => r.role === 'chef_de_chaine').map(r => r.user_id);

      setChaines(chainesData || []);
      setProfiles(allProfiles);
      setAgentQualiteProfiles(allProfiles.filter(p => agentQualiteIds.includes(p.id)));
      setChefDeChaineProfiles(allProfiles.filter(p => chefDeChaineIds.includes(p.id)));
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
    if (user && hasAccess(['admin'])) {
      fetchData();
    }
  }, [user]);

  const resetForm = () => {
    setFormNumChaine('');
    setFormResponsableQlty('');
    setFormChefDeChaine('');
    setFormNbrOperateur('');
  };

  const handleCreate = async () => {
    if (!formNumChaine || !formNbrOperateur) {
      toast({
        title: 'Erreur',
        description: 'Le numéro de chaîne et le nombre d\'opérateurs sont requis',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase.from('chaines').insert({
        num_chaine: parseInt(formNumChaine),
        responsable_qlty_id: formResponsableQlty && formResponsableQlty !== '__none__' ? formResponsableQlty : null,
        chef_de_chaine_id: formChefDeChaine && formChefDeChaine !== '__none__' ? formChefDeChaine : null,
        nbr_operateur: parseInt(formNbrOperateur),
      });

      if (error) throw error;

      toast({ title: 'Succès', description: 'Chaîne créée avec succès' });
      setIsCreateOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error creating chaine:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de créer la chaîne',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedChaine || !formNumChaine || !formNbrOperateur) return;

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('chaines')
        .update({
          num_chaine: parseInt(formNumChaine),
          responsable_qlty_id: formResponsableQlty && formResponsableQlty !== '__none__' ? formResponsableQlty : null,
          chef_de_chaine_id: formChefDeChaine && formChefDeChaine !== '__none__' ? formChefDeChaine : null,
          nbr_operateur: parseInt(formNbrOperateur),
        })
        .eq('id', selectedChaine.id);

      if (error) throw error;

      toast({ title: 'Succès', description: 'Chaîne mise à jour avec succès' });
      setIsEditOpen(false);
      setSelectedChaine(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error updating chaine:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de mettre à jour la chaîne',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (chaine: Chaine) => {
    try {
      const { error } = await supabase
        .from('chaines')
        .delete()
        .eq('id', chaine.id);

      if (error) throw error;

      toast({ title: 'Succès', description: 'Chaîne supprimée avec succès' });
      fetchData();
    } catch (error: any) {
      console.error('Error deleting chaine:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de supprimer la chaîne',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (chaine: Chaine) => {
    setSelectedChaine(chaine);
    setFormNumChaine(chaine.num_chaine.toString());
    setFormResponsableQlty(chaine.responsable_qlty_id || '__none__');
    setFormChefDeChaine(chaine.chef_de_chaine_id || '__none__');
    setFormNbrOperateur(chaine.nbr_operateur.toString());
    setIsEditOpen(true);
  };

  const getProfileDisplayName = (profile: Profile | null | undefined) => {
    if (!profile) return '-';
    return profile.full_name || profile.email || '-';
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Chaînes</h2>
            <p className="text-muted-foreground">
              Gérez les chaînes de production
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle chaîne
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer une chaîne</DialogTitle>
                <DialogDescription>Ajoutez une nouvelle chaîne de production</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Numéro de chaîne *</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 1"
                      value={formNumChaine}
                      onChange={(e) => setFormNumChaine(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre d'opérateurs *</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 10"
                      value={formNbrOperateur}
                      onChange={(e) => setFormNbrOperateur(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Responsable Qualité</Label>
                  <Select value={formResponsableQlty} onValueChange={setFormResponsableQlty}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un responsable" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucun</SelectItem>
                      {agentQualiteProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name || p.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Chef de chaîne</Label>
                  <Select value={formChefDeChaine} onValueChange={setFormChefDeChaine}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un chef" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucun</SelectItem>
                      {chefDeChaineProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name || p.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              Liste des chaînes
            </CardTitle>
            <CardDescription>
              {chaines.length} chaîne{chaines.length > 1 ? 's' : ''} de production
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
                    <TableHead>N° Chaîne</TableHead>
                    <TableHead>Responsable Qualité</TableHead>
                    <TableHead>Chef de Chaîne</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        Opérateurs
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chaines.map((chaine) => (
                    <TableRow key={chaine.id}>
                      <TableCell className="font-medium">
                        Chaîne {chaine.num_chaine}
                      </TableCell>
                      <TableCell>
                        {getProfileDisplayName(chaine.responsable_qlty as Profile)}
                      </TableCell>
                      <TableCell>
                        {getProfileDisplayName(chaine.chef_de_chaine as Profile)}
                      </TableCell>
                      <TableCell>{chaine.nbr_operateur}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(chaine)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer la chaîne ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Cette action est irréversible. La chaîne {chaine.num_chaine} sera définitivement supprimée.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(chaine)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {chaines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Aucune chaîne enregistrée
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier la chaîne</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Numéro de chaîne *</Label>
                  <Input
                    type="number"
                    value={formNumChaine}
                    onChange={(e) => setFormNumChaine(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nombre d'opérateurs *</Label>
                  <Input
                    type="number"
                    value={formNbrOperateur}
                    onChange={(e) => setFormNbrOperateur(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Responsable Qualité</Label>
                <Select value={formResponsableQlty} onValueChange={setFormResponsableQlty}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un responsable" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucun</SelectItem>
                    {agentQualiteProfiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name || p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Chef de chaîne</Label>
                <Select value={formChefDeChaine} onValueChange={setFormChefDeChaine}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un chef" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucun</SelectItem>
                    {chefDeChaineProfiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name || p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
