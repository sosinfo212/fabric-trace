import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Users, Loader2, Search } from 'lucide-react';
import { z } from 'zod';

interface Client {
  id: string;
  name: string;
  designation: string | null;
  instruction: string | null;
  instruction_logistique: string | null;
  created_at: string;
  updated_at: string;
}

const clientSchema = z.object({
  name: z.string().trim().min(1, { message: "Le nom est requis" }).max(255),
  designation: z.string().max(500).optional(),
  instruction: z.string().max(2000).optional(),
  instruction_logistique: z.string().max(2000).optional(),
});

export default function ClientsPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesignation, setFormDesignation] = useState('');
  const [formInstruction, setFormInstruction] = useState('');
  const [formInstructionLogistique, setFormInstructionLogistique] = useState('');

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les clients',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && hasAccess(['admin', 'planificatrice'])) {
      fetchClients();
    }
  }, [user]);

  const resetForm = () => {
    setFormName('');
    setFormDesignation('');
    setFormInstruction('');
    setFormInstructionLogistique('');
  };

  const handleCreate = async () => {
    try {
      const validation = clientSchema.safeParse({
        name: formName,
        designation: formDesignation || undefined,
        instruction: formInstruction || undefined,
        instruction_logistique: formInstructionLogistique || undefined,
      });

      if (!validation.success) {
        toast({
          title: 'Erreur de validation',
          description: validation.error.errors[0].message,
          variant: 'destructive',
        });
        return;
      }

      setSubmitting(true);

      const { error } = await supabase.from('clients').insert({
        name: formName,
        designation: formDesignation || null,
        instruction: formInstruction || null,
        instruction_logistique: formInstructionLogistique || null,
      });

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Client créé avec succès',
      });

      setIsCreateOpen(false);
      resetForm();
      fetchClients();
    } catch (error: any) {
      console.error('Error creating client:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de créer le client',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedClient) return;

    try {
      const validation = clientSchema.safeParse({
        name: formName,
        designation: formDesignation || undefined,
        instruction: formInstruction || undefined,
        instruction_logistique: formInstructionLogistique || undefined,
      });

      if (!validation.success) {
        toast({
          title: 'Erreur de validation',
          description: validation.error.errors[0].message,
          variant: 'destructive',
        });
        return;
      }

      setSubmitting(true);

      const { error } = await supabase
        .from('clients')
        .update({
          name: formName,
          designation: formDesignation || null,
          instruction: formInstruction || null,
          instruction_logistique: formInstructionLogistique || null,
        })
        .eq('id', selectedClient.id);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Client mis à jour avec succès',
      });

      setIsEditOpen(false);
      setSelectedClient(null);
      resetForm();
      fetchClients();
    } catch (error: any) {
      console.error('Error updating client:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de mettre à jour le client',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (client: Client) => {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Client supprimé avec succès',
      });

      fetchClients();
    } catch (error: any) {
      console.error('Error deleting client:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de supprimer le client',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (client: Client) => {
    setSelectedClient(client);
    setFormName(client.name);
    setFormDesignation(client.designation || '');
    setFormInstruction(client.instruction || '');
    setFormInstructionLogistique(client.instruction_logistique || '');
    setIsEditOpen(true);
  };

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.designation?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  if (!hasAccess(['admin', 'planificatrice'])) {
    return <Navigate to="/" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Clients</h2>
            <p className="text-muted-foreground">
              Gérez la liste des clients
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Créer un client</DialogTitle>
                <DialogDescription>
                  Ajoutez un nouveau client au système
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom *</Label>
                    <Input
                      id="name"
                      placeholder="Nom du client"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="designation">Désignation</Label>
                    <Input
                      id="designation"
                      placeholder="Désignation"
                      value={formDesignation}
                      onChange={(e) => setFormDesignation(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instruction">Instructions</Label>
                  <Textarea
                    id="instruction"
                    placeholder="Instructions générales..."
                    value={formInstruction}
                    onChange={(e) => setFormInstruction(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instruction_logistique">Instructions logistiques</Label>
                  <Textarea
                    id="instruction_logistique"
                    placeholder="Instructions logistiques..."
                    value={formInstructionLogistique}
                    onChange={(e) => setFormInstructionLogistique(e.target.value)}
                    rows={3}
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

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Liste des clients
                </CardTitle>
                <CardDescription>
                  {filteredClients.length} client{filteredClients.length > 1 ? 's' : ''}
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
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
                    <TableHead>Nom</TableHead>
                    <TableHead>Désignation</TableHead>
                    <TableHead>Instructions</TableHead>
                    <TableHead>Instructions logistiques</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>{client.designation || '-'}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {client.instruction || '-'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {client.instruction_logistique || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(client)}
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
                                <AlertDialogTitle>Supprimer le client ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Cette action est irréversible. Le client "{client.name}" sera définitivement supprimé.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(client)}
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
                  {filteredClients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {searchQuery ? 'Aucun client trouvé' : 'Aucun client enregistré'}
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Modifier le client</DialogTitle>
              <DialogDescription>
                Modifier les informations du client
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editName">Nom *</Label>
                  <Input
                    id="editName"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editDesignation">Désignation</Label>
                  <Input
                    id="editDesignation"
                    value={formDesignation}
                    onChange={(e) => setFormDesignation(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editInstruction">Instructions</Label>
                <Textarea
                  id="editInstruction"
                  value={formInstruction}
                  onChange={(e) => setFormInstruction(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editInstructionLogistique">Instructions logistiques</Label>
                <Textarea
                  id="editInstructionLogistique"
                  value={formInstructionLogistique}
                  onChange={(e) => setFormInstructionLogistique(e.target.value)}
                  rows={3}
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
