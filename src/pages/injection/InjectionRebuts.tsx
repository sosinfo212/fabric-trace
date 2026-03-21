import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { injectionApi, type InjectionRebutOrderRow } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  DialogHeader,
  DialogTitle,
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
} from '@/components/ui/alert-dialog';
import { Plus, History, Pencil, Trash2, Search, Loader2, RefreshCw, Filter, Settings2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { ConformityBadge } from './components/ConformityBadge';
import { RebutModal } from './RebutModal';
import { EditRebutModal } from './EditRebutModal';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 100;

const SEARCH_COLUMNS: Record<string, string> = {
  of: 'OF',
  designation: 'Désignation',
};

function formatDateTime(d: string | null) {
  if (!d) return '—';
  const date = new Date(d);
  return isNaN(date.getTime()) ? '—' : format(date, 'dd/MM/yyyy HH:mm', { locale: fr });
}

export default function InjectionRebutsPage() {
  const queryClient = useQueryClient();
  const { loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();
  const canAccess = hasMenuAccess('/injection/waste');

  const [searchByColumn, setSearchByColumn] = useState<Record<string, string>>({});
  const [searchInColumns, setSearchInColumns] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    Object.keys(SEARCH_COLUMNS).forEach((k) => (o[k] = true));
    return o;
  });
  const [rebutOrder, setRebutOrder] = useState<InjectionRebutOrderRow | null>(null);
  const [rebutModalOpen, setRebutModalOpen] = useState(false);
  const [historyOf, setHistoryOf] = useState<string | null>(null);
  const [historyRows, setHistoryRows] = useState<Awaited<ReturnType<typeof injectionApi.getRebutHistory>>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editRebut, setEditRebut] = useState<Awaited<ReturnType<typeof injectionApi.getRebut>> | null>(null);
  const [editRebutOpen, setEditRebutOpen] = useState(false);
  const [deleteRebutId, setDeleteRebutId] = useState<number | null>(null);

  const { data: ordres = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['injection-rebuts'],
    queryFn: () => injectionApi.getRebuts(),
    enabled: !!canAccess,
  });

  const activeSearchKeys = useMemo(
    () => Object.keys(SEARCH_COLUMNS).filter((k) => searchInColumns[k]),
    [searchInColumns]
  );

  const filteredOrdres = useMemo(() => {
    let list = ordres;
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
        return String(cell).toLowerCase().includes(val.toLowerCase());
      })
    );
  }, [ordres, searchByColumn, activeSearchKeys]);

  const displayOrdres = filteredOrdres.slice(0, PAGE_SIZE);

  const openHistory = (of: string) => {
    setHistoryOf(of);
    setHistoryLoading(true);
    injectionApi.getRebutHistory(of).then(setHistoryRows).finally(() => setHistoryLoading(false));
  };

  const deleteRebutMutation = useMutation({
    mutationFn: (id: number) => injectionApi.deleteRebut(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['injection-rebuts'] });
      setDeleteRebutId(null);
      if (historyOf) injectionApi.getRebutHistory(historyOf).then(setHistoryRows);
      toast({ title: 'Rebut supprimé.' });
    },
    onError: () => toast({ title: 'Erreur', variant: 'destructive' }),
  });

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
          <h1 className="text-2xl font-bold tracking-tight">Injection / Déclaration rebut</h1>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={cn('h-4 w-4', isRefetching && 'animate-spin')} />
          </Button>
        </div>

        {/* Filters card — same pattern as Laquage/Serigraphie */}
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {activeSearchKeys.map((key) => (
                <div key={key} className="flex flex-col gap-1.5 min-w-0">
                  <Label className="text-xs text-muted-foreground truncate">
                    {SEARCH_COLUMNS[key]}
                  </Label>
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Liste des ordres - Déclaration rebut</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredOrdres.length} ordre(s){' '}
                {filteredOrdres.length > PAGE_SIZE ? `(affichage des ${PAGE_SIZE} premiers)` : ''}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isRefetching}>
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
                      <TableHead>OF</TableHead>
                      <TableHead>Désignation</TableHead>
                      <TableHead>Qté</TableHead>
                      <TableHead>% Conformité</TableHead>
                      <TableHead className="w-[140px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayOrdres.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          {activeSearchKeys.some((k) => (searchByColumn[k] ?? '').trim() !== '')
                            ? 'Aucun ordre pour les filtres sélectionnés.'
                            : 'Aucun ordre trouvé.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayOrdres.map((row) => (
                        <TableRow key={row.of}>
                          <TableCell className="font-medium">{row.of}</TableCell>
                          <TableCell>{row.designation}</TableCell>
                          <TableCell>{row.quantite}</TableCell>
                          <TableCell>
                            <ConformityBadge conformity={row.conformity} />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => openHistory(row.of)}
                                aria-label="Historique"
                              >
                                <History className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setRebutOrder(row);
                                  setRebutModalOpen(true);
                                }}
                                aria-label="Déclarer rebut"
                              >
                                <Plus className="h-4 w-4" />
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

      {rebutOrder && (
        <RebutModal
          open={rebutModalOpen}
          onOpenChange={(o) => {
            setRebutModalOpen(o);
            if (!o) setRebutOrder(null);
          }}
          order={rebutOrder}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['injection-rebuts'] });
            setRebutModalOpen(false);
            setRebutOrder(null);
          }}
        />
      )}

      <Dialog open={historyOf != null} onOpenChange={(o) => !o && setHistoryOf(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historique - OF: {historyOf ?? ''}</DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-[#b4b0b0]">
                  <TableHead className="text-[10px] font-bold uppercase">OF</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase">Composant</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase">Défaut</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase">Causes</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase">Quantité</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase">Utilisateur</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-[13px]">{r.of}</TableCell>
                    <TableCell className="text-[13px]">{r.composant}</TableCell>
                    <TableCell className="text-[13px]">{r.defaut}</TableCell>
                    <TableCell className="text-[13px]">{r.cause}</TableCell>
                    <TableCell className="text-[13px] font-bold text-red-600">{r.quantite}</TableCell>
                    <TableCell className="text-[13px]">{r.username ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 text-blue-600"
                          onClick={() => {
                            setHistoryOf(null);
                            injectionApi.getRebut(r.id).then((item) => {
                              setEditRebut(item);
                              setEditRebutOpen(true);
                            });
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 text-red-600"
                          onClick={() => setDeleteRebutId(r.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {editRebut && (
        <EditRebutModal
          open={editRebutOpen}
          onOpenChange={(o) => {
            setEditRebutOpen(o);
            if (!o) setEditRebut(null);
          }}
          item={editRebut}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['injection-rebuts'] });
            setEditRebutOpen(false);
            setEditRebut(null);
            if (historyOf) injectionApi.getRebutHistory(historyOf).then(setHistoryRows);
          }}
        />
      )}

      <AlertDialog open={deleteRebutId != null} onOpenChange={(o) => !o && setDeleteRebutId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>Voulez-vous vraiment supprimer ce rebut ?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive"
              onClick={() => deleteRebutId != null && deleteRebutMutation.mutate(deleteRebutId)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
