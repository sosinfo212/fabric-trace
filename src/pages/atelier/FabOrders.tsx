import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fabOrdersApi, chainsApi, clientsApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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

// Priority Input Component for inline editing
function PriorityInput({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  const [localValue, setLocalValue] = useState(value);

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleBlur = () => {
    onChange(localValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <Input
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      placeholder="Priorité"
      className="w-[120px]"
    />
  );
}

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
  chaines: { id: string; num_chaine: number; responsable_qlty_name?: string | null } | null;
};

export default function FabOrdersPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess, isAdmin } = useUserRole();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [chaineFilter, setChaineFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  const canAccess = hasMenuAccess('/atelier/fab-orders');

  // Fetch chains for filter (with profile username for display)
  const { data: chaines } = useQuery({
    queryKey: ['chaines'],
    queryFn: async () => {
      const data = await chainsApi.getAll();
      return data.map((c: any) => {
        const displayName =
          c.chef_de_chaine?.full_name ||
          c.chef_de_chaine?.email ||
          c.responsable_qlty?.full_name ||
          c.responsable_qlty?.email ||
          `Chaîne ${c.num_chaine}`;
        return { id: c.id, num_chaine: c.num_chaine, displayName };
      });
    },
    enabled: !!user,
  });

  // Fetch clients for filter
  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const data = await clientsApi.getAll();
      return data.map((c: any) => ({ id: c.id, name: c.name, designation: c.designation }));
    },
    enabled: !!user,
  });

  // Fetch fab orders
  const { data: fabOrders, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['fab-orders', statusFilter, chaineFilter, clientFilter, search],
    queryFn: async () => {
      let data = await fabOrdersApi.getAll();
      
      // Apply filters
      if (statusFilter !== 'all') {
        data = data.filter((order: any) => order.statut_of === statusFilter);
      }
      if (chaineFilter !== 'all') {
        data = data.filter((order: any) => order.chaine_id === chaineFilter);
      }
      if (clientFilter !== 'all') {
        data = data.filter((order: any) => order.client_id === clientFilter);
      }
      if (search) {
        const searchLower = search.toLowerCase();
        data = data.filter((order: any) => 
          order.of_id?.toLowerCase().includes(searchLower) ||
          order.sale_order_id?.toLowerCase().includes(searchLower) ||
          order.prod_name?.toLowerCase().includes(searchLower) ||
          order.prod_ref?.toLowerCase().includes(searchLower) ||
          order.client_id?.toLowerCase().includes(searchLower)
        );
      }
      
      // Sort by creation_date_of descending
      data.sort((a: any, b: any) => 
        new Date(b.creation_date_of).getTime() - new Date(a.creation_date_of).getTime()
      );
      
      return data as FabOrder[];
    },
    enabled: !!user && canAccess,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fabOrdersApi.delete(id);
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
      await fabOrdersApi.update(id, { statut_of: status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fab-orders'] });
      toast({ title: 'Statut mis à jour' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Chaine update mutation
  const chaineMutation = useMutation({
    mutationFn: async ({ id, chaine_id }: { id: string; chaine_id: string }) => {
      await fabOrdersApi.update(id, { chaine_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fab-orders'] });
      toast({ title: 'Chaîne mise à jour' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Priority update mutation
  const priorityMutation = useMutation({
    mutationFn: async ({ id, order_prod }: { id: string; order_prod: string | null }) => {
      await fabOrdersApi.update(id, { order_prod });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fab-orders'] });
      toast({ title: 'Priorité mise à jour' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // Delete all selected orders
      await Promise.all(ids.map(id => fabOrdersApi.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fab-orders'] });
      setSelectedRows(new Set());
      setShowBulkDeleteDialog(false);
      toast({ title: `${selectedRows.size} ordre(s) supprimé(s) avec succès` });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Handle row selection
  const toggleRowSelection = (id: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  // Handle select all
  const toggleSelectAll = () => {
    if (selectedRows.size === fabOrders?.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(fabOrders?.map(order => order.id) || []));
    }
  };

  // Handle bulk delete
  const handleBulkDelete = () => {
    if (selectedRows.size > 0) {
      bulkDeleteMutation.mutate(Array.from(selectedRows));
    }
  };

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
    return <Navigate to="/auth" replace />;
  }

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Ordres de Fabrication</h1>
          <div className="flex gap-2">
            {isAdmin && selectedRows.size > 0 && (
              <Button 
                variant="destructive" 
                onClick={() => setShowBulkDeleteDialog(true)}
                disabled={bulkDeleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer ({selectedRows.size})
              </Button>
            )}
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
                  <SelectValue placeholder="Chaîne / Responsable" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les chaînes</SelectItem>
                  {chaines?.map((chaine) => (
                    <SelectItem key={chaine.id} value={chaine.id}>
                      {chaine.displayName}
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
                    <SelectItem key={client.id} value={client.name}>
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              aria-label="Actualiser la liste"
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
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
                      {isAdmin && (
                        <TableHead className="w-12">
                          <Checkbox
                            checked={fabOrders && fabOrders.length > 0 && selectedRows.size === fabOrders.length}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Sélectionner tout"
                          />
                        </TableHead>
                      )}
                      <TableHead>Client</TableHead>
                      <TableHead>N° Commande</TableHead>
                      <TableHead>OF ID</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead>Référence</TableHead>
                      <TableHead>Chaîne</TableHead>
                      <TableHead>Chef qualité</TableHead>
                      <TableHead>Priorité</TableHead>
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
                        <TableCell colSpan={isAdmin ? 16 : 15} className="text-center text-muted-foreground">
                          Aucun ordre de fabrication trouvé
                        </TableCell>
                      </TableRow>
                    ) : (
                      fabOrders?.map((order) => (
                        <TableRow key={order.id}>
                          {isAdmin && (
                            <TableCell>
                              <Checkbox
                                checked={selectedRows.has(order.id)}
                                onCheckedChange={() => toggleRowSelection(order.id)}
                                aria-label={`Sélectionner ${order.of_id}`}
                              />
                            </TableCell>
                          )}
                          <TableCell>{order.client_id || '-'}</TableCell>
                          <TableCell>{order.sale_order_id}</TableCell>
                          <TableCell className="font-mono">{order.of_id}</TableCell>
                          <TableCell>{order.prod_name || '-'}</TableCell>
                          <TableCell>{order.prod_ref || '-'}</TableCell>
                          <TableCell>
                            {canAccess ? (
                              <Select
                                value={order.chaine_id}
                                onValueChange={(value) => chaineMutation.mutate({ id: order.id, chaine_id: value })}
                                disabled={chaineMutation.isPending}
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue>
                                    {order.chaines?.num_chaine ? `Chaîne ${order.chaines.num_chaine}` : 'Sélectionner'}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {chaines?.map((chaine) => (
                                    <SelectItem key={chaine.id} value={chaine.id}>
                                      Chaîne {chaine.num_chaine}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              order.chaines?.num_chaine ? `Chaîne ${order.chaines.num_chaine}` : '-'
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {order.chaines?.responsable_qlty_name || '-'}
                          </TableCell>
                          <TableCell>
                            {canAccess ? (
                              <PriorityInput
                                value={order.order_prod || ''}
                                onChange={(value) => {
                                  const trimmedValue = value.trim() || null;
                                  if (trimmedValue !== (order.order_prod || null)) {
                                    priorityMutation.mutate({ id: order.id, order_prod: trimmedValue });
                                  }
                                }}
                                disabled={priorityMutation.isPending}
                              />
                            ) : (
                              <span>{order.order_prod || '-'}</span>
                            )}
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
                              <DropdownMenuContent align="end" className="bg-popover">
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

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression multiple</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {selectedRows.size} ordre(s) de fabrication ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteMutation.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground"
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Suppression...
                </>
              ) : (
                `Supprimer ${selectedRows.size} ordre(s)`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
