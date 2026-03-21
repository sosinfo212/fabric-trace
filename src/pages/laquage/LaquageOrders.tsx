import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { laquageApi, type LaquageOrder } from '@/lib/api';
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
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { Plus, Pencil, Trash2, Search, RefreshCw, Filter, Loader2, Settings2, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { CreateOrderModal } from './CreateOrderModal';
import { EditOrderModal } from './EditOrderModal';
import { StatusBadge } from './components/StatusBadge';
import { TauxBadge } from './components/TauxBadge';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = ['Planifié', 'En cours', 'Réalisé'] as const;
const PAGE_SIZE = 100;

// Searchable columns (key matches LaquageOrder fields); configurable filter like Serigraphie
const SEARCH_COLUMNS: Record<string, string> = {
  client: 'Client',
  commande: 'Commande',
  OFID: 'OFID',
  designation: 'Désignation',
  date_production: 'Date de production',
  status: 'Statut',
};

function formatDateShort(d: string | null) {
  if (!d) return '—';
  const date = new Date(d);
  return isNaN(date.getTime()) ? '—' : format(date, 'dd MMM', { locale: fr });
}

function formatDateLong(d: string | null) {
  if (!d) return '—';
  const date = new Date(d);
  return isNaN(date.getTime()) ? '—' : format(date, 'dd MMM yyyy', { locale: fr });
}

export default function LaquageOrdersPage() {
  const queryClient = useQueryClient();
  const { loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();
  const canAccess = hasMenuAccess('/lacquering/orders');

  const [searchByColumn, setSearchByColumn] = useState<Record<string, string>>({});
  const [searchInColumns, setSearchInColumns] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    Object.keys(SEARCH_COLUMNS).forEach((k) => (o[k] = true));
    return o;
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<LaquageOrder | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [savingOrdreId, setSavingOrdreId] = useState<number | null>(null);
  const [successOrdreId, setSuccessOrdreId] = useState<number | null>(null);

  const { data: orders = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['laquage-orders'],
    queryFn: () => laquageApi.getOrders(),
    enabled: !!canAccess,
  });

  const updateOrdreMutation = useMutation({
    mutationFn: ({ id, ordre }: { id: number; ordre: number | null }) =>
      laquageApi.updateOrdre(id, ordre),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['laquage-orders'] });
      setSavingOrdreId(null);
      setSuccessOrdreId(id);
      setTimeout(() => setSuccessOrdreId(null), 1000);
    },
    onError: () => {
      setSavingOrdreId(null);
      toast({ title: 'Erreur', description: 'Impossible de mettre à jour l\'ordre.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => laquageApi.deleteOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laquage-orders'] });
      setDeleteId(null);
      toast({ title: 'Ordre supprimé.' });
    },
    onError: () => {
      toast({ title: 'Erreur', description: 'Impossible de supprimer l\'ordre.', variant: 'destructive' });
    },
  });

  const activeSearchKeys = useMemo(
    () => Object.keys(SEARCH_COLUMNS).filter((k) => searchInColumns[k]),
    [searchInColumns]
  );

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (activeSearchKeys.length === 0) return list;
    const criteria = activeSearchKeys
      .map((key) => {
        const val = searchByColumn[key]?.trim();
        return val ? { key, val } : null;
      })
      .filter(Boolean) as { key: string; val: string }[];
    if (criteria.length === 0) return list;
    return list.filter((o) =>
      criteria.every(({ key, val }) => {
        const cell = (o as Record<string, unknown>)[key];
        if (cell == null) return false;
        if (key === 'date_production') return String(cell).slice(0, 10) === val;
        if (key === 'status') {
          const selected = val.split(',').map((s) => s.trim()).filter(Boolean);
          return selected.length > 0 && selected.includes(String(cell));
        }
        return String(cell).toLowerCase().includes(val.toLowerCase());
      })
    );
  }, [orders, searchByColumn, activeSearchKeys]);

  const displayOrders = filteredOrders.slice(0, PAGE_SIZE);

  const handleOrdreBlur = (row: LaquageOrder, value: string) => {
    const num = value === '' ? null : parseInt(value, 10);
    const current = row.ordre;
    if (num === current) return;
    if (num !== null && (num < 1 || !Number.isFinite(num))) return;
    setSavingOrdreId(row.id);
    updateOrdreMutation.mutate({ id: row.id, ordre: num });
  };

  if (authLoading || roleLoading || !canAccess) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[200px]">
          {!canAccess ? <p>Accès non autorisé.</p> : <p>Chargement...</p>}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Laquage - Ordres de Production</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              aria-label="Actualiser"
            >
              <RefreshCw className={cn('h-4 w-4', isRefetching && 'animate-spin')} />
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un ordre de production
            </Button>
          </div>
        </div>

        {/* Filters card — same pattern as /serigraphie/orders */}
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Filtres</CardTitle>
                {(() => {
                  const activeCount = activeSearchKeys.filter(
                    (k) => (searchByColumn[k] ?? '').trim() !== ''
                  ).length;
                  if (activeCount > 0) {
                    return (
                      <span className="text-xs text-muted-foreground">
                        ({activeCount} actif{activeCount > 1 ? 's' : ''})
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                      <Settings2 className="h-3.5 w-3.5" />
                      Colonnes
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-3" align="end">
                    <p className="text-sm font-medium mb-2">Colonnes à afficher dans les filtres</p>
                    <div className="space-y-2">
                      {Object.entries(SEARCH_COLUMNS).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={searchInColumns[key] === true}
                            onCheckedChange={(checked) =>
                              setSearchInColumns((prev) => ({ ...prev, [key]: !!checked }))
                            }
                          />
                          <span className="text-sm">{label}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                {activeSearchKeys.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setSearchByColumn((prev) => {
                        const next = { ...prev };
                        activeSearchKeys.forEach((k) => (next[k] = ''));
                        return next;
                      });
                    }}
                  >
                    Effacer les filtres
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {activeSearchKeys.map((key) => (
                <div key={key} className="flex flex-col gap-1.5 min-w-0">
                  <Label className="text-xs text-muted-foreground truncate">
                    {SEARCH_COLUMNS[key]}
                  </Label>
                  {key === 'date_production' ? (
                    <Input
                      type="date"
                      value={searchByColumn[key] ?? ''}
                      onChange={(e) =>
                        setSearchByColumn((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="h-9 w-full min-w-0"
                    />
                  ) : key === 'status' ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="h-9 w-full justify-between font-normal text-xs"
                        >
                          <span className="truncate">
                            {(() => {
                              const v = searchByColumn[key] ?? '';
                              const arr = v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];
                              if (arr.length === 0) return 'Tous';
                              if (arr.length <= 2) return arr.join(', ');
                              return `${arr.length} statuts`;
                            })()}
                          </span>
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-52 p-3" align="start">
                        <p className="text-sm font-medium mb-2">Statut</p>
                        <div className="space-y-2">
                          {STATUS_OPTIONS.map((s) => {
                            const v = searchByColumn[key] ?? '';
                            const selected = v ? v.split(',').map((x) => x.trim()).filter(Boolean) : [];
                            const checked = selected.includes(s);
                            return (
                              <label key={s} className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(checked) => {
                                    const next = checked
                                      ? [...selected, s]
                                      : selected.filter((x) => x !== s);
                                    setSearchByColumn((prev) => ({
                                      ...prev,
                                      [key]: next.join(','),
                                    }));
                                  }}
                                />
                                <span className="text-sm">{s}</span>
                              </label>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <Input
                        placeholder={SEARCH_COLUMNS[key]}
                        value={searchByColumn[key] ?? ''}
                        onChange={(e) =>
                          setSearchByColumn((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="h-9 w-full min-w-0 pl-8"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {activeSearchKeys.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">
                Cliquez sur « Colonnes » pour choisir les champs à filtrer.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Data table card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Liste des ordres</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredOrders.length} ordre(s){' '}
                {filteredOrders.length > PAGE_SIZE
                  ? `(affichage des ${PAGE_SIZE} premiers)`
                  : ''}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              aria-label="Actualiser la liste"
            >
              <RefreshCw className={cn('h-4 w-4', isRefetching && 'animate-spin')} />
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Ordre</TableHead>
                      <TableHead>Date de création</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Commande</TableHead>
                      <TableHead>OFID</TableHead>
                      <TableHead>Désignation</TableHead>
                      <TableHead>Date de production</TableHead>
                      <TableHead>Quantité (P/F)</TableHead>
                      <TableHead>Taux</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                          {activeSearchKeys.some((k) => (searchByColumn[k] ?? '').trim() !== '')
                            ? 'Aucun ordre pour les filtres sélectionnés.'
                            : 'Aucun ordre de production enregistré.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayOrders.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              defaultValue={row.ordre ?? ''}
                              className={cn(
                                'w-[80px] h-8 text-sm border bg-transparent',
                                successOrdreId === row.id && 'border-2 border-green-500'
                              )}
                              disabled={savingOrdreId === row.id}
                              onBlur={(e) => handleOrdreBlur(row, e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                            />
                          </TableCell>
                          <TableCell>{formatDateShort(row.created_at)}</TableCell>
                          <TableCell>{row.client}</TableCell>
                          <TableCell>{row.commande}</TableCell>
                          <TableCell className="font-mono">{row.OFID}</TableCell>
                          <TableCell>{row.designation}</TableCell>
                          <TableCell>{formatDateLong(row.date_production)}</TableCell>
                          <TableCell>
                            <span className="font-semibold">{row.quantite_planifie}</span>
                            <span className="mx-1">/</span>
                            <span className="font-semibold text-blue-600">{row.quantiteFabriqueeTotal ?? 0}</span>
                          </TableCell>
                          <TableCell>
                            <TauxBadge taux={row.tauxRealisation ?? 0} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={row.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditOrder(row);
                                  setEditOpen(true);
                                }}
                                aria-label="Modifier"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteId(row.id)}
                                aria-label="Supprimer"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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

      <CreateOrderModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['laquage-orders'] })}
      />
      <EditOrderModal
        open={editOpen}
        onOpenChange={setEditOpen}
        order={editOrder}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['laquage-orders'] })}
      />

      <AlertDialog open={deleteId != null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment supprimer cet ordre de production ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteId != null && deleteMutation.mutate(deleteId)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
