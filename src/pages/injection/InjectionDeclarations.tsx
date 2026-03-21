import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { injectionApi, type InjectionDeclarationRow } from '@/lib/api';
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
import { Plus, History, Pencil, Trash2, Search, Loader2, RefreshCw, Filter, Settings2, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { StatusBadge } from './components/StatusBadge';
import { DeclarationModal } from './DeclarationModal';
import { EditDeclarationModal } from './EditDeclarationModal';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = ['Planifié', 'En cours', 'Réalisé'] as const;
const PAGE_SIZE = 100;

const SEARCH_COLUMNS: Record<string, string> = {
  of: 'OF',
  designation: 'Désignation',
  status: 'Statut',
};

function formatDateTime(d: string | null) {
  if (!d) return '—';
  const date = new Date(d);
  return isNaN(date.getTime()) ? '—' : format(date, 'dd/MM/yyyy HH:mm', { locale: fr });
}

export default function InjectionDeclarationsPage() {
  const queryClient = useQueryClient();
  const { loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();
  const canAccess = hasMenuAccess('/injection/declaration');

  const [searchByColumn, setSearchByColumn] = useState<Record<string, string>>({});
  const [searchInColumns, setSearchInColumns] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    Object.keys(SEARCH_COLUMNS).forEach((k) => (o[k] = true));
    return o;
  });
  const [historyOf, setHistoryOf] = useState<string | null>(null);
  const [historyRows, setHistoryRows] = useState<Awaited<ReturnType<typeof injectionApi.getDeclarationHistory>>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [declareRow, setDeclareRow] = useState<InjectionDeclarationRow | null>(null);
  const [declareOpen, setDeclareOpen] = useState(false);
  const [editDeclId, setEditDeclId] = useState<number | null>(null);
  const [editDeclItem, setEditDeclItem] = useState<Awaited<ReturnType<typeof injectionApi.getDeclaration>> | null>(null);
  const [editDeclOpen, setEditDeclOpen] = useState(false);
  const [deleteDeclId, setDeleteDeclId] = useState<number | null>(null);

  const { data: rows = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['injection-declarations'],
    queryFn: () => injectionApi.getDeclarations(),
    enabled: !!canAccess,
  });

  const activeSearchKeys = useMemo(
    () => Object.keys(SEARCH_COLUMNS).filter((k) => searchInColumns[k]),
    [searchInColumns]
  );

  const filteredRows = useMemo(() => {
    let list = rows;
    if (activeSearchKeys.length === 0) return list;
    const criteria = activeSearchKeys
      .map((key) => {
        const val = searchByColumn[key]?.trim();
        return val ? { key, val } : null;
      })
      .filter(Boolean) as { key: string; val: string }[];
    if (criteria.length === 0) return list;
    return list.filter((r) =>
      criteria.every(({ key, val }) => {
        const cell = (r as Record<string, unknown>)[key];
        if (cell == null) return false;
        if (key === 'status') {
          const selected = val.split(',').map((s) => s.trim()).filter(Boolean);
          return selected.length > 0 && selected.includes(String(cell));
        }
        return String(cell).toLowerCase().includes(val.toLowerCase());
      })
    );
  }, [rows, searchByColumn, activeSearchKeys]);

  const displayRows = filteredRows.slice(0, PAGE_SIZE);

  const openHistory = (of: string) => {
    setHistoryOf(of);
    setHistoryLoading(true);
    injectionApi.getDeclarationHistory(of).then(setHistoryRows).finally(() => setHistoryLoading(false));
  };

  const deleteDeclMutation = useMutation({
    mutationFn: (id: number) => injectionApi.deleteDeclaration(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['injection-declarations'] });
      setDeleteDeclId(null);
      if (historyOf) injectionApi.getDeclarationHistory(historyOf).then(setHistoryRows);
      toast({ title: 'Déclaration supprimée.' });
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
          <h1 className="text-2xl font-bold tracking-tight">Injection / Déclaration fabrication</h1>
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {activeSearchKeys.map((key) => (
                <div key={key} className="flex flex-col gap-1.5 min-w-0">
                  <Label className="text-xs text-muted-foreground truncate">
                    {SEARCH_COLUMNS[key]}
                  </Label>
                  {key === 'status' ? (
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Liste des déclarations</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredRows.length} déclaration(s){' '}
                {filteredRows.length > PAGE_SIZE ? `(affichage des ${PAGE_SIZE} premiers)` : ''}
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
                      <TableHead>Quantité</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          {activeSearchKeys.some((k) => (searchByColumn[k] ?? '').trim() !== '')
                            ? 'Aucune déclaration pour les filtres sélectionnés.'
                            : 'Aucune déclaration enregistrée.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayRows.map((row) => (
                        <TableRow key={row.of}>
                          <TableCell className="font-medium">{row.of}</TableCell>
                          <TableCell>{row.designation}</TableCell>
                          <TableCell>{row.quantite}</TableCell>
                          <TableCell>
                            <StatusBadge status={row.status} />
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
                                  setDeclareRow(row);
                                  setDeclareOpen(true);
                                }}
                                aria-label="Déclarer"
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

      {declareRow && (
        <DeclarationModal
          open={declareOpen}
          onOpenChange={setDeclareOpen}
          row={declareRow}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['injection-declarations'] });
            setDeclareOpen(false);
            setDeclareRow(null);
          }}
        />
      )}

      <Dialog open={historyOf != null} onOpenChange={(open) => !open && setHistoryOf(null)}>
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
                  <TableHead className="text-[10px] font-bold uppercase">Désignation</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase">Quantité</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase">Machine</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase">N° Moule</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase">Nbr Empreinte</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase">Date début</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase">Date fin</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase">Effectif</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase">Utilisateur</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyRows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-[13px]">{d.designation}</TableCell>
                    <TableCell className="text-[13px]">{d.quantite}</TableCell>
                    <TableCell className="text-[13px]">{d.machine}</TableCell>
                    <TableCell className="text-[13px]">{d.num_moule ?? '—'}</TableCell>
                    <TableCell className="text-[13px]">{d.nbr_empreinte ?? '—'}</TableCell>
                    <TableCell className="text-[13px]">{formatDateTime(d.date_debut)}</TableCell>
                    <TableCell className="text-[13px]">{formatDateTime(d.date_fin)}</TableCell>
                    <TableCell className="text-[13px]">{d.effectif}</TableCell>
                    <TableCell className="text-[13px]">{d.username ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 text-blue-600"
                          onClick={() => {
                            setHistoryOf(null);
                            injectionApi.getDeclaration(d.id).then((item) => {
                              setEditDeclItem(item);
                              setEditDeclOpen(true);
                            });
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 text-red-600"
                          onClick={() => setDeleteDeclId(d.id)}
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

      {editDeclItem != null && (
        <EditDeclarationModal
          open={editDeclOpen}
          onOpenChange={(o) => {
            setEditDeclOpen(o);
            if (!o) setEditDeclItem(null);
          }}
          declaration={editDeclItem}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['injection-declarations'] });
            setEditDeclOpen(false);
            setEditDeclItem(null);
            if (historyOf) injectionApi.getDeclarationHistory(historyOf).then(setHistoryRows);
          }}
        />
      )}

      <AlertDialog open={deleteDeclId != null} onOpenChange={(open) => !open && setDeleteDeclId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>Voulez-vous vraiment supprimer cette déclaration ?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive"
              onClick={() => {
                if (deleteDeclId != null) deleteDeclMutation.mutate(deleteDeclId);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
