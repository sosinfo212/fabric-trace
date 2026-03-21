import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fabOrdersApi, chainsApi, clientsApi, fabricationApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { toast } from '@/hooks/use-toast';
import { Plus, History, Loader2, Search, RefreshCw, FileText, Trash2, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const TIME_MIN_MINUTES = 8 * 60; // 08:00
const TIME_MAX_MINUTES = 17 * 60 + 20; // 17:20

function isTimeInWindow(date: Date): boolean {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes >= TIME_MIN_MINUTES && minutes <= TIME_MAX_MINUTES;
}

function formatSpent(start: string | null, end: string | null): string {
  if (!start || !end) return '-';
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (b <= a) return '-';
  const ms = b - a;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const STATUS_OPTIONS = ['Planifié', 'En cours', 'Réalisé', 'Cloturé', 'Suspendu'] as const;

type DeclarationOrder = {
  id: string;
  of_id: string;
  order_prod: string | null;
  chaine_id: string | null;
  statut_of: string | null;
  sale_order_id: string;
  lot_set: string;
  pf_qty: number;
  tester_qty: number;
  set_qty: number;
  date_planifiee: string | null;
  client_name: string | null;
  product_name: string | null;
  num_chaine: number | null;
};

export default function DeclarationPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();

  const canAccess = hasMenuAccess('/workshop/declaration');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [chaineFilter, setChaineFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyOfId, setHistoryOfId] = useState<string | null>(null);
  const [historyOrder, setHistoryOrder] = useState<DeclarationOrder | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | number | null>(null);
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    valid_date: '',
    date_fabrication: '',
    end_fab_date: '',
    lot_jus: '',
    effectif_reel: '',
    pf_qty: 0,
    sf_qty: 0,
    set_qty: 0,
    tester_qty: 0,
    comment_chaine: '',
  });

  const queryClient = useQueryClient();

  // Fetch chains for filter (same as fab-orders: displayName from profiles)
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
    enabled: !!user && canAccess,
  });

  // Fetch clients for filter
  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const data = await clientsApi.getAll();
      return data.map((c: any) => ({ id: c.id, name: c.name, designation: c.designation }));
    },
    enabled: !!user && canAccess,
  });

  // Fetch declaration data
  const { data: ordersRaw, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['fab-orders-declaration'],
    queryFn: async () => {
      const data = await fabOrdersApi.getDeclaration();
      return data as DeclarationOrder[];
    },
    enabled: !!user && canAccess,
  });

  // Apply same filters as fab-orders
  const orders = (() => {
    let data = ordersRaw ?? [];
    if (statusFilter !== 'all') {
      data = data.filter((o) => o.statut_of === statusFilter);
    }
    if (chaineFilter !== 'all') {
      data = data.filter((o) => o.chaine_id === chaineFilter);
    }
    if (clientFilter !== 'all') {
      data = data.filter((o) => o.client_name === clientFilter);
    }
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      data = data.filter(
        (o) =>
          (o.of_id && o.of_id.toLowerCase().includes(term)) ||
          (o.sale_order_id && o.sale_order_id.toLowerCase().includes(term)) ||
          (o.client_name && o.client_name.toLowerCase().includes(term)) ||
          (o.product_name && o.product_name.toLowerCase().includes(term)) ||
          (o.lot_set && o.lot_set.toLowerCase().includes(term))
      );
    }
    return data;
  })();

  const handleAdd = (orderId: string) => {
    navigate(`/workshop/declaration/${orderId}/add`);
  };

  const { data: fabricationHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['fabrication-history', historyOfId],
    queryFn: () => fabricationApi.getByOFID(historyOfId!),
    enabled: historyModalOpen && !!historyOfId,
  });

  const handleHistory = (order: DeclarationOrder) => {
    setHistoryOfId(order.of_id);
    setHistoryOrder(order);
    setHistoryModalOpen(true);
  };

  const closeHistoryModal = () => {
    setHistoryModalOpen(false);
    setHistoryOfId(null);
    setHistoryOrder(null);
    setEditingRow(null);
    setDeleteConfirmId(null);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => fabricationApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fabrication-history', historyOfId] });
      toast({ title: 'Déclaration supprimée' });
      setDeleteConfirmId(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: Record<string, unknown> }) =>
      fabricationApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fabrication-history', historyOfId] });
      toast({ title: 'Déclaration mise à jour' });
      setEditingRow(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  useEffect(() => {
    if (!editingRow) return;
    setEditForm({
      valid_date: editingRow.Valid_date ? format(new Date(editingRow.Valid_date), 'yyyy-MM-dd') : '',
      date_fabrication: editingRow.date_fabrication
        ? format(new Date(editingRow.date_fabrication), "yyyy-MM-dd'T'HH:mm")
        : '',
      end_fab_date: editingRow.End_Fab_date
        ? format(new Date(editingRow.End_Fab_date), "yyyy-MM-dd'T'HH:mm")
        : '',
      lot_jus: editingRow.Lot_Jus ?? '',
      effectif_reel: String(editingRow.effectif_Reel ?? ''),
      pf_qty: editingRow.Pf_Qty ?? 0,
      sf_qty: editingRow.Sf_Qty ?? 0,
      set_qty: editingRow.Set_qty ?? 0,
      tester_qty: editingRow.Tester_qty ?? 0,
      comment_chaine: editingRow.Comment_chaine ?? '',
    });
  }, [editingRow]);

  const handleEditSave = () => {
    if (!editingRow) return;
    const start = editForm.date_fabrication ? new Date(editForm.date_fabrication).getTime() : 0;
    const end = editForm.end_fab_date ? new Date(editForm.end_fab_date).getTime() : 0;
    if (start && end && start >= end) {
      toast({ title: 'Début de production doit être antérieur à la fin', variant: 'destructive' });
      return;
    }
    if (editForm.date_fabrication) {
      const startDate = new Date(editForm.date_fabrication);
      if (!isTimeInWindow(startDate)) {
        toast({
          title: 'Heure invalide',
          description: 'L\'heure du Début de production doit être entre 08:00 et 17:20.',
          variant: 'destructive',
        });
        return;
      }
    }
    if (editForm.end_fab_date) {
      const endDate = new Date(editForm.end_fab_date);
      if (!isTimeInWindow(endDate)) {
        toast({
          title: 'Heure invalide',
          description: 'L\'heure de Fin de production doit être entre 08:00 et 17:20.',
          variant: 'destructive',
        });
        return;
      }
    }
    updateMutation.mutate({
      id: editingRow.id,
      data: {
        Lot_Jus: editForm.lot_jus || null,
        Valid_date: editForm.valid_date ? `${editForm.valid_date} 00:00:00` : null,
        effectif_Reel: editForm.effectif_reel === '' ? null : Number(editForm.effectif_reel),
        date_fabrication: editForm.date_fabrication
          ? format(new Date(editForm.date_fabrication), 'yyyy-MM-dd HH:mm:ss')
          : null,
        End_Fab_date: editForm.end_fab_date
          ? format(new Date(editForm.end_fab_date), 'yyyy-MM-dd HH:mm:ss')
          : null,
        Pf_Qty: Number(editForm.pf_qty),
        Sf_Qty: Number(editForm.sf_qty),
        Set_qty: Number(editForm.set_qty),
        Tester_qty: Number(editForm.tester_qty),
        Comment_chaine: editForm.comment_chaine || null,
      },
    });
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
          <h1 className="text-3xl font-bold">Déclaration Fabrication</h1>
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
            <CardTitle>Liste des Ordres ({orders?.length || 0})</CardTitle>
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
                      <TableHead>DATE PLANIFIÉE</TableHead>
                      <TableHead>OFID</TableHead>
                      <TableHead>Chaîne</TableHead>
                      <TableHead>Priorité</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Commande</TableHead>
                      <TableHead>Lot set</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right">Pf</TableHead>
                      <TableHead className="text-right">Tester</TableHead>
                      <TableHead className="text-right">Set</TableHead>
                      <TableHead className="text-right">Total Qte</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={13} className="text-center text-muted-foreground">
                          Aucun ordre de fabrication trouvé
                        </TableCell>
                      </TableRow>
                    ) : (
                      orders?.map((order) => {
                        const totalQty = (order.pf_qty || 0) + (order.tester_qty || 0) + (order.set_qty || 0);
                        return (
                          <TableRow key={order.id}>
                            <TableCell>
                              {order.date_planifiee
                                ? format(new Date(order.date_planifiee), 'dd/MM/yyyy', { locale: fr })
                                : '-'}
                            </TableCell>
                            <TableCell className="font-mono">{order.of_id}</TableCell>
                            <TableCell>
                              {order.num_chaine != null ? `Chaîne ${order.num_chaine}` : '-'}
                            </TableCell>
                            <TableCell>{order.order_prod || '-'}</TableCell>
                            <TableCell>{order.client_name || '-'}</TableCell>
                            <TableCell>{order.sale_order_id}</TableCell>
                            <TableCell>{order.lot_set || '-'}</TableCell>
                            <TableCell>{order.product_name || '-'}</TableCell>
                            <TableCell className="text-right">{order.pf_qty || 0}</TableCell>
                            <TableCell className="text-right">{order.tester_qty || 0}</TableCell>
                            <TableCell className="text-right">{order.set_qty || 0}</TableCell>
                            <TableCell className="text-right font-semibold">{totalQty}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAdd(order.id)}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleHistory(order)}
                                >
                                  <History className="h-4 w-4 mr-1" />
                                  History
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* History modal: design with summary cards + table + Fermer */}
        <Dialog open={historyModalOpen} onOpenChange={(open) => !open && closeHistoryModal()}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" aria-describedby={historyModalOpen ? 'history-dialog-desc' : undefined}>
            <DialogHeader className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <DialogTitle className="text-xl">Historique de Fabrication Ref: {historyOfId ?? '-'}</DialogTitle>
              </div>
              <DialogDescription id="history-dialog-desc" className="sr-only">
                Liste des déclarations pour l&apos;OF sélectionné.
              </DialogDescription>
              {/* Summary cards: PF, SF, SET, TESTER */}
              {!historyLoading && fabricationHistory && (
                <div className="grid grid-cols-4 gap-3">
                  {(() => {
                    const sumPf = fabricationHistory.reduce((s: number, r: any) => s + (r.Pf_Qty ?? 0), 0);
                    const sumSf = fabricationHistory.reduce((s: number, r: any) => s + (r.Sf_Qty ?? 0), 0);
                    const sumSet = fabricationHistory.reduce((s: number, r: any) => s + (r.Set_qty ?? 0), 0);
                    const sumTester = fabricationHistory.reduce((s: number, r: any) => s + (r.Tester_qty ?? 0), 0);
                    const plannedPf = historyOrder?.pf_qty ?? 0;
                    const plannedSet = historyOrder?.set_qty ?? 0;
                    const plannedTester = historyOrder?.tester_qty ?? 0;
                    return (
                      <>
                        <div className="rounded-lg border-2 border-blue-500 bg-blue-500/5 p-3">
                          <div className="text-xs font-semibold uppercase text-muted-foreground">PF</div>
                          <div className="mt-1 flex items-baseline gap-1">
                            <Badge className="bg-blue-600">{sumPf}</Badge>
                            <span className="text-sm">/ {plannedPf}</span>
                          </div>
                        </div>
                        <div className="rounded-lg border-2 border-green-500 bg-green-500/5 p-3">
                          <div className="text-xs font-semibold uppercase text-muted-foreground">SF</div>
                          <div className="mt-1 flex items-baseline gap-1">
                            <Badge className="bg-green-600">{sumSf}</Badge>
                            <span className="text-sm">/ 0</span>
                          </div>
                        </div>
                        <div className="rounded-lg border-2 border-rose-500 bg-rose-500/5 p-3">
                          <div className="text-xs font-semibold uppercase text-muted-foreground">SET</div>
                          <div className="mt-1 flex items-baseline gap-1">
                            <Badge className="bg-rose-600">{sumSet}</Badge>
                            <span className="text-sm">/ {plannedSet}</span>
                          </div>
                        </div>
                        <div className="rounded-lg border-2 border-amber-500 bg-amber-500/5 p-3">
                          <div className="text-xs font-semibold uppercase text-muted-foreground">TESTER</div>
                          <div className="mt-1 flex items-baseline gap-1">
                            <Badge className="bg-amber-600">{sumTester}</Badge>
                            <span className="text-sm">/ {plannedTester}</span>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </DialogHeader>
            <div className="overflow-auto flex-1 -mx-6 px-6 min-h-0">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !fabricationHistory?.length ? (
                <p className="text-center text-muted-foreground py-8">Aucune déclaration pour cet OF.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>OFID</TableHead>
                      <TableHead>LOT JUS</TableHead>
                      <TableHead>VALID DATE</TableHead>
                      <TableHead>EFFECTIF REEL</TableHead>
                      <TableHead>FABRICATION DATE</TableHead>
                      <TableHead className="text-right">PF QTY</TableHead>
                      <TableHead className="text-right">SF QTY</TableHead>
                      <TableHead className="text-right">SET QTY</TableHead>
                      <TableHead className="text-right">TESTER QTY</TableHead>
                      <TableHead>COMMENT</TableHead>
                      <TableHead>SPENT</TableHead>
                      <TableHead className="w-[90px]">ACTION</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fabricationHistory.map((row: any) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono">{row.OFID ?? historyOfId ?? '-'}</TableCell>
                        <TableCell>{row.Lot_Jus ?? '-'}</TableCell>
                        <TableCell>
                          {row.Valid_date
                            ? format(new Date(row.Valid_date), 'yyyy-MM-dd', { locale: fr })
                            : '-'}
                        </TableCell>
                        <TableCell>{row.effectif_Reel ?? '-'}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {row.date_fabrication ? (
                            <span className="block">
                              {format(new Date(row.date_fabrication), 'd MMM yyyy', { locale: fr })}
                              <span className="block text-muted-foreground text-sm">
                                {format(new Date(row.date_fabrication), 'HH:mm', { locale: fr })}
                              </span>
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right">{row.Pf_Qty ?? 0}</TableCell>
                        <TableCell className="text-right">{row.Sf_Qty ?? 0}</TableCell>
                        <TableCell className="text-right">{row.Set_qty ?? 0}</TableCell>
                        <TableCell className="text-right">{row.Tester_qty ?? 0}</TableCell>
                        <TableCell className="max-w-[180px] text-sm" title={row.Comment_chaine ?? ''}>
                          <span className="line-clamp-2">{row.Comment_chaine ?? '-'}</span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatSpent(row.date_fabrication, row.End_Fab_date)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setDeleteConfirmId(row.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 border-amber-500 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20"
                              onClick={() => setEditingRow(row)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <DialogFooter className="border-t pt-4 sm:justify-end">
              {historyOfId && (
                <Button variant="outline" size="sm" onClick={() => { navigate(`/workshop/declaration/history/${encodeURIComponent(historyOfId)}`); closeHistoryModal(); }}>
                  Voir la page
                </Button>
              )}
              <Button variant="secondary" onClick={closeHistoryModal}>
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer la déclaration</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. Confirmer la suppression de cette déclaration ?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteConfirmId != null && deleteMutation.mutate(deleteConfirmId)}
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit fabrication dialog */}
        <Dialog open={!!editingRow} onOpenChange={(open) => !open && setEditingRow(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="edit-fabrication-desc">
            <DialogHeader>
              <DialogTitle>Modifier la déclaration</DialogTitle>
              <DialogDescription id="edit-fabrication-desc">
                Modifiez les champs ci-dessous puis enregistrez.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Date validité (Valid_date)</Label>
                  <Input
                    type="date"
                    value={editForm.valid_date}
                    onChange={(e) => setEditForm((f) => ({ ...f, valid_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Début production *</Label>
                  <Input
                    type="datetime-local"
                    value={editForm.date_fabrication}
                    onChange={(e) => setEditForm((f) => ({ ...f, date_fabrication: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fin production *</Label>
                  <Input
                    type="datetime-local"
                    value={editForm.end_fab_date}
                    onChange={(e) => setEditForm((f) => ({ ...f, end_fab_date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label>Lot Jus</Label>
                  <Input
                    value={editForm.lot_jus}
                    onChange={(e) => setEditForm((f) => ({ ...f, lot_jus: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Effectif réel</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editForm.effectif_reel}
                    onChange={(e) => setEditForm((f) => ({ ...f, effectif_reel: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>PF Qty</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editForm.pf_qty}
                    onChange={(e) => setEditForm((f) => ({ ...f, pf_qty: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>SF Qty</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editForm.sf_qty}
                    onChange={(e) => setEditForm((f) => ({ ...f, sf_qty: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Set Qty</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editForm.set_qty}
                    onChange={(e) => setEditForm((f) => ({ ...f, set_qty: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tester Qty</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editForm.tester_qty}
                    onChange={(e) => setEditForm((f) => ({ ...f, tester_qty: Number(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Commentaire</Label>
                <Textarea
                  value={editForm.comment_chaine}
                  onChange={(e) => setEditForm((f) => ({ ...f, comment_chaine: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingRow(null)}>
                Annuler
              </Button>
              <Button onClick={handleEditSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
