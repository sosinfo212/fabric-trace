import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { 
  Plus, 
  Search, 
  Eye, 
  Pencil, 
  Trash2, 
  Upload, 
  Loader2,
  MoreHorizontal,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_OPTIONS = ['Planifié', 'En cours', 'Réalisé', 'Cloturé', 'Suspendu'] as const;

const STATUS_COLORS: Record<string, string> = {
  'Planifié': 'bg-blue-100 text-blue-800',
  'En cours': 'bg-yellow-100 text-yellow-800',
  'Réalisé': 'bg-green-100 text-green-800',
  'Cloturé': 'bg-gray-100 text-gray-800',
  'Suspendu': 'bg-red-100 text-red-800',
};

type FabOrder = {
  id: string;
  of_id: string;
  product_id: string | null;
  prod_ref: string | null;
  prod_name: string | null;
  chaine_id: string;
  sale_order_id: string;
  client_id: string;
  creation_date_of: string;
  date_fabrication: string | null;
  pf_qty: number;
  sf_qty: number;
  set_qty: number;
  tester_qty: number;
  lot_set: string;
  instruction: string | null;
  comment_chaine: string | null;
  end_prod: string | null;
  statut_of: string;
  comment: string | null;
  order_prod: string | null;
  products: { id: string; ref_id: string; product_name: string } | null;
  clients: { id: string; name: string; designation: string | null } | null;
  chaines: { id: string; num_chaine: number } | null;
};

export default function FabOrdersPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading, hasAccess } = useUserRole();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [chaineFilter, setChaineFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Check access
  const canAccess = hasAccess(['admin', 'chef_chaine', 'chef_de_chaine', 'controle']);
  const isAdmin = hasAccess(['admin']);

  // Fetch chains for filter
  const { data: chaines } = useQuery({
    queryKey: ['chaines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chaines')
        .select('id, num_chaine')
        .order('num_chaine');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch clients for filter
  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, designation')
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch fab orders
  const { data: fabOrders, isLoading, refetch } = useQuery({
    queryKey: ['fab-orders', statusFilter, chaineFilter, clientFilter, search],
    queryFn: async () => {
      let query = supabase
        .from('fab_orders')
        .select(`
          *,
          products:product_id (id, ref_id, product_name),
          clients:client_id (id, name, designation),
          chaines:chaine_id (id, num_chaine)
        `)
        .order('creation_date_of', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('statut_of', statusFilter);
      }

      if (chaineFilter !== 'all') {
        query = query.eq('chaine_id', chaineFilter);
      }

      if (clientFilter !== 'all') {
        query = query.eq('client_id', clientFilter);
      }

      if (search) {
        query = query.or(`of_id.ilike.%${search}%,sale_order_id.ilike.%${search}%,prod_name.ilike.%${search}%,prod_ref.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FabOrder[];
    },
    enabled: !!user && canAccess,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fab_orders')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fab-orders'] });
      toast({ title: 'Ordre supprimé avec succès' });
      setDeleteId(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Status update mutation
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('fab_orders')
        .update({ statut_of: status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fab-orders'] });
      toast({ title: 'Statut mis à jour' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  if (authLoading || roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (!canAccess) {
    navigate('/');
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Ordres de Fabrication</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => toast({ title: 'Import Excel', description: 'Fonctionnalité en cours de développement' })}>
              <Upload className="h-4 w-4 mr-2" />
              Importer Excel
            </Button>
            <Button onClick={() => navigate('/atelier/fab-orders/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvel Ordre
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtres</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={chaineFilter} onValueChange={setChaineFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Chaîne" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les chaînes</SelectItem>
                  {chaines?.map((chaine) => (
                    <SelectItem key={chaine.id} value={chaine.id}>
                      Chaîne {chaine.num_chaine}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les clients</SelectItem>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.designation || client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Liste des Ordres ({fabOrders?.length || 0})</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>N° Commande</TableHead>
                      <TableHead>OF ID</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead>Référence</TableHead>
                      <TableHead>Chaîne</TableHead>
                      <TableHead>Date Fab.</TableHead>
                      <TableHead className="text-right">PF Qty</TableHead>
                      <TableHead className="text-right">Tester</TableHead>
                      <TableHead className="text-right">Set</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fabOrders?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={13} className="text-center text-muted-foreground">
                          Aucun ordre de fabrication trouvé
                        </TableCell>
                      </TableRow>
                    ) : (
                      fabOrders?.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>{order.clients?.designation || order.clients?.name || '-'}</TableCell>
                          <TableCell>{order.sale_order_id}</TableCell>
                          <TableCell className="font-mono">{order.of_id}</TableCell>
                          <TableCell>{order.products?.product_name || order.prod_name || '-'}</TableCell>
                          <TableCell>{order.products?.ref_id || order.prod_ref || '-'}</TableCell>
                          <TableCell>
                            {order.chaines?.num_chaine ? `Chaîne ${order.chaines.num_chaine}` : '-'}
                          </TableCell>
                          <TableCell>
                            {order.date_fabrication
                              ? format(new Date(order.date_fabrication), 'dd/MM/yyyy', { locale: fr })
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right">{order.pf_qty}</TableCell>
                          <TableCell className="text-right">{order.tester_qty}</TableCell>
                          <TableCell className="text-right">{order.set_qty}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {order.pf_qty + order.tester_qty + order.set_qty}
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_COLORS[order.statut_of] || 'bg-gray-100'}>
                              {order.statut_of}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate(`/atelier/fab-orders/${order.id}`)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Voir
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/atelier/fab-orders/${order.id}/edit`)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Modifier
                                </DropdownMenuItem>
                                {isAdmin && (
                                  <DropdownMenuItem 
                                    onClick={() => setDeleteId(order.id)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Supprimer
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => statusMutation.mutate({ id: order.id, status: 'En cours' })}
                                  disabled={order.statut_of === 'En cours'}
                                >
                                  Marquer En cours
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => statusMutation.mutate({ id: order.id, status: 'Réalisé' })}
                                  disabled={order.statut_of === 'Réalisé'}
                                >
                                  Marquer Réalisé
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cet ordre de fabrication ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
