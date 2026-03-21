import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { transfertApi } from '@/lib/api';
import { useUserRole } from '@/hooks/useUserRole';
import { StatusBadge } from '@/components/transfer/StatusBadge';
import { MouvementBadge } from '@/components/transfer/MouvementBadge';
import { ProcessedDataModal } from '@/components/transfer/ProcessedDataModal';
import { UpdateTransfertModal } from '@/components/transfer/UpdateTransfertModal';
import { FileBarChart, FileSpreadsheet, Loader2, Filter, Search, Settings2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { RapportFilters as RapportFiltersType } from '@/types/transfert';
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

const SEARCH_COLUMNS: Record<string, string> = {
  recherche: 'Recherche globale',
  date: 'Date',
  mouvement: 'Mouvement',
  statut: 'Statut',
};

const MOUVEMENT_OPTIONS = ['A->M', 'M->A'] as const;
const STATUT_OPTIONS = ['Envoyé', 'Récéptionné', 'Annulé'] as const;

export default function TransferReportPage() {
  const queryClient = useQueryClient();
  const { role } = useUserRole();
  const [searchByColumn, setSearchByColumn] = useState<Record<string, string>>({});
  const [searchInColumns, setSearchInColumns] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    Object.keys(SEARCH_COLUMNS).forEach((k) => (o[k] = true));
    return o;
  });
  const [processedData, setProcessedData] = useState<import('@/types/transfert').ProcessedDataResponse | null>(null);
  const [processedModalOpen, setProcessedModalOpen] = useState(false);
  const [editTransfertId, setEditTransfertId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [validatingIds, setValidatingIds] = useState<Set<number>>(new Set());
  const [showValidateDialog, setShowValidateDialog] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['transfert-list'],
    queryFn: async () => {
      const res = await transfertApi.getAll();
      return res.data;
    },
  });

  const activeSearchKeys = useMemo(
    () => Object.keys(SEARCH_COLUMNS).filter((k) => searchInColumns[k]),
    [searchInColumns]
  );

  const filters: RapportFiltersType = useMemo(() => {
    const mouvementVal = (searchByColumn.mouvement ?? '').trim();
    const statutVal = (searchByColumn.statut ?? '').trim();
    return {
      globalSearch: (searchByColumn.recherche ?? '').trim() || undefined,
      dateFilter: (searchByColumn.date ?? '').trim() || undefined,
      movementFilters: mouvementVal ? mouvementVal.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      statusFilters: statutVal ? statutVal.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    };
  }, [searchByColumn]);

  const filteredList = useMemo(() => {
    let list = data ?? [];
    if (activeSearchKeys.length === 0) {
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    const criteria = activeSearchKeys
      .map((key) => {
        const val = searchByColumn[key]?.trim();
        return val ? { key, val } : null;
      })
      .filter(Boolean) as { key: string; val: string }[];
    if (criteria.length === 0) {
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    list = list.filter((t) =>
      criteria.every(({ key, val }) => {
        if (key === 'recherche') {
          const q = val.toLowerCase();
          return (
            (t.client && t.client.toLowerCase().includes(q)) ||
            (t.product && t.product.toLowerCase().includes(q)) ||
            (t.numComm && t.numComm.toLowerCase().includes(q)) ||
            (t.comment && t.comment.toLowerCase().includes(q))
          );
        }
        if (key === 'date') return t.createdAt && t.createdAt.slice(0, 10) === val;
        if (key === 'mouvement') {
          const selected = val.split(',').map((s) => s.trim()).filter(Boolean);
          return selected.length > 0 && selected.includes(t.mouvement ?? '');
        }
        if (key === 'statut') {
          const selected = val.split(',').map((s) => s.trim()).filter(Boolean);
          return selected.length > 0 && selected.includes(t.statut ?? '');
        }
        return true;
      })
    );
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data, searchByColumn, activeSearchKeys]);

  const canDoubleClickEdit = role === 'admin' || role === 'responsable_magasin_pf';

  const handleProcessData = async () => {
    try {
      const res = await transfertApi.processExcel(filters);
      setProcessedData(res);
      setProcessedModalOpen(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur traitement');
    }
  };

  const handleExportExcel = async () => {
    try {
      await transfertApi.exportExcel(filters);
      toast.success('Export téléchargé');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur export');
    }
  };

  const selectedEnvoyeIds = useMemo(() => {
    return filteredList.filter((t) => t.statut === 'Envoyé' && selectedIds.has(t.id)).map((t) => t.id);
  }, [filteredList, selectedIds]);

  const handleValidateSelected = async () => {
    if (selectedEnvoyeIds.length === 0) {
      toast.error('Aucun transfert Envoyé sélectionné');
      return;
    }
    setValidatingIds(new Set(selectedEnvoyeIds));
    try {
      for (const id of selectedEnvoyeIds) {
        await transfertApi.validate(id);
      }
      toast.success(`${selectedEnvoyeIds.length} transfert(s) réceptionné(s)`);
      queryClient.invalidateQueries({ queryKey: ['transfert-list'] });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        selectedEnvoyeIds.forEach((id) => next.delete(id));
        return next;
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur validation');
    } finally {
      setValidatingIds(new Set());
    }
  };

  const toggleRow = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const envoyes = filteredList.filter((t) => t.statut === 'Envoyé');
    const allSelected = envoyes.every((t) => selectedIds.has(t.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) envoyes.forEach((t) => next.delete(t.id));
      else envoyes.forEach((t) => next.add(t.id));
      return next;
    });
  };

  const envoyesInList = useMemo(
    () => filteredList.filter((t) => t.statut === 'Envoyé'),
    [filteredList]
  );
  const allEnvoyeSelected =
    envoyesInList.length > 0 && envoyesInList.every((t) => selectedIds.has(t.id));

  const clearFilters = () => {
    setSearchByColumn((prev) => {
      const next = { ...prev };
      activeSearchKeys.forEach((k) => (next[k] = ''));
      return next;
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rapport Fabrication</h1>
          <p className="text-muted-foreground">Analyse et suivi des mouvements de fabrication</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="default" className="bg-blue-600 hover:bg-blue-700" onClick={handleProcessData}>
            <FileBarChart className="mr-2 h-4 w-4" />
            Traiter les Données
          </Button>
          <Button
            variant="default"
            className="bg-green-600 hover:bg-green-700"
            onClick={handleExportExcel}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Exporter Groupé
          </Button>
          {selectedIds.size > 0 && (
            <Button
              variant="default"
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => setShowValidateDialog(true)}
              disabled={selectedEnvoyeIds.length === 0 || validatingIds.size > 0}
            >
              {validatingIds.size > 0 ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Valider ({selectedEnvoyeIds.length})
            </Button>
          )}
        </div>

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
                    onClick={clearFilters}
                  >
                    Effacer les filtres
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
              {activeSearchKeys.map((key) => (
                <div key={key} className="flex flex-col gap-1.5 min-w-0">
                  <Label className="text-xs text-muted-foreground truncate">
                    {SEARCH_COLUMNS[key]}
                  </Label>
                  {key === 'recherche' ? (
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
                  ) : key === 'date' ? (
                    <Input
                      type="date"
                      value={searchByColumn[key] ?? ''}
                      onChange={(e) =>
                        setSearchByColumn((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="h-9 w-full min-w-0"
                    />
                  ) : key === 'mouvement' ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 text-left"
                        >
                          <span className="truncate">
                            {(() => {
                              const v = searchByColumn[key] ?? '';
                              const arr = v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];
                              if (arr.length === 0) return 'Sélectionner...';
                              if (arr.length <= 2) return arr.join(', ');
                              return `${arr.length} sélectionné(s)`;
                            })()}
                          </span>
                          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-0" align="start" sideOffset={4}>
                        <div className="p-2 border-b">
                          <p className="text-sm font-medium">Mouvement</p>
                          <p className="text-xs text-muted-foreground">Choix multiples</p>
                        </div>
                        <div className="p-2 max-h-[240px] overflow-auto">
                          {MOUVEMENT_OPTIONS.map((s) => {
                            const v = searchByColumn[key] ?? '';
                            const selected = v ? v.split(',').map((x) => x.trim()).filter(Boolean) : [];
                            const checked = selected.includes(s);
                            return (
                              <label
                                key={s}
                                className="flex items-center gap-2 cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(c) => {
                                    const next = c
                                      ? [...selected, s]
                                      : selected.filter((x) => x !== s);
                                    setSearchByColumn((prev) => ({
                                      ...prev,
                                      [key]: next.join(','),
                                    }));
                                  }}
                                />
                                <span>{s}</span>
                              </label>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : key === 'statut' ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 text-left"
                        >
                          <span className="truncate">
                            {(() => {
                              const v = searchByColumn[key] ?? '';
                              const arr = v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];
                              if (arr.length === 0) return 'Sélectionner...';
                              if (arr.length <= 2) return arr.join(', ');
                              return `${arr.length} sélectionné(s)`;
                            })()}
                          </span>
                          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-0" align="start" sideOffset={4}>
                        <div className="p-2 border-b">
                          <p className="text-sm font-medium">Statut</p>
                          <p className="text-xs text-muted-foreground">Choix multiples</p>
                        </div>
                        <div className="p-2 max-h-[240px] overflow-auto">
                          {STATUT_OPTIONS.map((s) => {
                            const v = searchByColumn[key] ?? '';
                            const selected = v ? v.split(',').map((x) => x.trim()).filter(Boolean) : [];
                            const checked = selected.includes(s);
                            return (
                              <label
                                key={s}
                                className="flex items-center gap-2 cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(c) => {
                                    const next = c
                                      ? [...selected, s]
                                      : selected.filter((x) => x !== s);
                                    setSearchByColumn((prev) => ({
                                      ...prev,
                                      [key]: next.join(','),
                                    }));
                                  }}
                                />
                                <span>{s}</span>
                              </label>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : null}
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
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-[#f8f9fa] to-[#e9ecef] [&_th]:uppercase [&_th]:text-xs">
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={allEnvoyeSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Tout sélectionner (Envoyé)"
                        />
                      </TableHead>
                      <TableHead className="w-[80px]">Commande</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-center w-[70px]">Qté Boîtes</TableHead>
                      <TableHead className="text-center w-[80px]">Unité/Boîte</TableHead>
                      <TableHead className="text-center w-[70px]">Qté Unités</TableHead>
                      <TableHead className="text-center w-[80px]">Total Qté</TableHead>
                      <TableHead className="w-[70px]">Mouvement</TableHead>
                      <TableHead className="w-[70px]">N° Palette</TableHead>
                      <TableHead className="w-[100px]">Statut</TableHead>
                      <TableHead className="w-[80px]">Action</TableHead>
                      <TableHead>Commentaire</TableHead>
                      <TableHead className="w-[120px]">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredList.map((t) => (
                      <TableRow
                        key={t.id}
                        className={
                          t.statut === 'Envoyé'
                            ? 'bg-[#fff3cd] border-l-4 border-l-[#ffc107]'
                            : t.statut === 'Récéptionné'
                              ? 'bg-[#d4edda] border-l-4 border-l-[#28a745]'
                              : ''
                        }
                        onDoubleClick={() => canDoubleClickEdit && setEditTransfertId(t.id)}
                      >
                        <TableCell>
                          {t.statut === 'Envoyé' ? (
                            <Checkbox
                              checked={selectedIds.has(t.id)}
                              onCheckedChange={() => toggleRow(t.id)}
                              disabled={validatingIds.has(t.id)}
                              aria-label={`Sélectionner transfert ${t.id}`}
                            />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{t.numComm}</TableCell>
                        <TableCell>{t.client}</TableCell>
                        <TableCell>{t.product}</TableCell>
                        <TableCell className="text-center">{t.qtyBox}</TableCell>
                        <TableCell className="text-center">{t.unitPerbox ?? 'N/A'}</TableCell>
                        <TableCell className="text-center">{t.qtyUnit}</TableCell>
                        <TableCell className="text-center">
                          {t.totalQty ?? (t.qtyBox * (t.unitPerbox ?? 0) + t.qtyUnit)}
                        </TableCell>
                        <TableCell>
                          <MouvementBadge mouvement={t.mouvement} variant="rapport" />
                        </TableCell>
                        <TableCell className="text-center">{t.numPal}</TableCell>
                        <TableCell>
                          <StatusBadge statut={t.statut} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">-</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.comment ?? 'N/A'}</TableCell>
                        <TableCell className="text-xs">
                          {t.createdAt ? format(new Date(t.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr }) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {processedData && (
          <ProcessedDataModal
            open={processedModalOpen}
            onOpenChange={setProcessedModalOpen}
            data={processedData}
          />
        )}

        {editTransfertId != null && (
          <UpdateTransfertModal
            transfertId={editTransfertId}
            open={true}
            onOpenChange={(open) => !open && setEditTransfertId(null)}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['transfert-list'] });
              setEditTransfertId(null);
            }}
          />
        )}

        <AlertDialog open={showValidateDialog} onOpenChange={(o) => !o && setShowValidateDialog(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Valider la réception</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir valider la réception de {selectedEnvoyeIds.length} transfert(s) sélectionné(s) ?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={validatingIds.size > 0}>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowValidateDialog(false);
                  handleValidateSelected();
                }}
                disabled={validatingIds.size > 0}
              >
                Valider
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
