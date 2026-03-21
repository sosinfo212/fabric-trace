import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { DateRange } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/hooks/useUserRole';
import {
  unifiedRebutReportApi,
  type UnifiedRebutFilters,
  type UnifiedRebutRow,
  type UnifiedRebutType,
} from '@/lib/api';
import {
  Calendar,
  Check,
  Download,
  FileBarChart,
  Filter,
  Lock,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';

const TYPE_STYLE: Record<UnifiedRebutType, { label: string; className: string }> = {
  laquage: { label: 'Laquage', className: 'bg-cyan-500 text-white' },
  hors_prod: { label: 'Hors Production', className: 'bg-green-600 text-white' },
  serigraphie: { label: 'Sérigraphie', className: 'bg-yellow-500 text-gray-900' },
  conformity: { label: 'Atelier', className: 'bg-blue-600 text-white' },
};

function formatDateOnly(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return format(d, 'dd MMM yyyy', { locale: fr });
}

function nextSort(current: 'asc' | 'desc') {
  return current === 'asc' ? 'desc' : 'asc';
}

const PAGE_OPTIONS = [10, 25, 50, 100, -1];

export default function UnifiedRebutReportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasMenuAccess, loading: roleLoading } = useUserRole();
  const canAccess = hasMenuAccess('/components/waste-report');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortColumn, setSortColumn] = useState('date_declaration');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [draftFilters, setDraftFilters] = useState<UnifiedRebutFilters>({
    startDate: '',
    endDate: '',
    rebutType: '',
    chaineId: '',
    bottleFilter: false,
    searchText: '',
    showLocked: false,
  });
  const [appliedFilters, setAppliedFilters] = useState<UnifiedRebutFilters>({
    startDate: '',
    endDate: '',
    rebutType: '',
    chaineId: '',
    bottleFilter: false,
    searchText: '',
    showLocked: false,
  });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateRangeModalOpen, setDateRangeModalOpen] = useState(false);
  const [modalDateRange, setModalDateRange] = useState<{ startDate: Date; endDate: Date; key: 'selection' }>(() => {
    const now = new Date();
    return { startDate: now, endDate: now, key: 'selection' };
  });
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (draftFilters.startDate || draftFilters.endDate) count += 1;
    if (draftFilters.rebutType) count += 1;
    if (draftFilters.chaineId) count += 1;
    if (draftFilters.searchText?.trim()) count += 1;
    if (draftFilters.showLocked) count += 1;
    if (draftFilters.bottleFilter) count += 1;
    return count;
  }, [draftFilters]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(draftFilters.searchText?.trim() || '');
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [draftFilters.searchText]);

  useEffect(() => {
    setAppliedFilters((prev) => ({ ...prev, searchText: debouncedSearch }));
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    // Bottle filter applies instantly.
    setAppliedFilters((prev) => ({ ...prev, bottleFilter: !!draftFilters.bottleFilter }));
    setPage(1);
  }, [draftFilters.bottleFilter]);

  const { data: typeData } = useQuery({
    queryKey: ['waste-report-types'],
    queryFn: () => unifiedRebutReportApi.getTypes(),
    enabled: canAccess,
    staleTime: 60_000,
  });

  const { data: chainesData } = useQuery({
    queryKey: ['waste-report-chaines'],
    queryFn: () => unifiedRebutReportApi.getChaines(),
    enabled: canAccess,
    staleTime: 60_000,
  });

  const {
    data: tableData,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['waste-report-data', page, pageSize, sortColumn, sortDirection, appliedFilters],
    queryFn: () =>
      unifiedRebutReportApi.getData({
        ...appliedFilters,
        page,
        pageSize,
        sortColumn,
        sortDirection,
      }),
    enabled: canAccess,
    staleTime: 10_000,
  });

  const rows = (tableData?.data || []) as UnifiedRebutRow[];
  const total = tableData?.recordsFiltered || 0;
  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(total / pageSize));

  const unlockedRows = useMemo(
    () => rows.filter((r) => r.status && r.rebutType !== 'conformity'),
    [rows]
  );
  const allSelected = unlockedRows.length > 0 && unlockedRows.every((r) => selectedIds.includes(r.uniqueId));
  const currentQtyTotal = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
    [rows]
  );

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => unlockedRows.some((r) => r.uniqueId === id)));
  }, [unlockedRows]);

  const validateSingleMutation = useMutation({
    mutationFn: (payload: { id: string; type: UnifiedRebutType }) =>
      unifiedRebutReportApi.validateSingle(payload.id, payload.type),
    onSuccess: async (resp) => {
      toast.success(resp.message || 'Entrée validée.');
      await queryClient.invalidateQueries({ queryKey: ['waste-report-data'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Erreur de validation.');
    },
  });

  const bulkValidateMutation = useMutation({
    mutationFn: (entries: Array<{ id: string; type: UnifiedRebutType }>) =>
      unifiedRebutReportApi.bulkValidate(entries),
    onSuccess: async (resp) => {
      toast.success(resp.message || 'Validation en masse terminée.');
      if (resp.errors?.length) {
        toast.warning(`${resp.errors.length} entrée(s) non validée(s).`);
      }
      setSelectedIds([]);
      await queryClient.invalidateQueries({ queryKey: ['waste-report-data'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Erreur de validation en masse.');
    },
  });

  const selectedEntries = useMemo(
    () =>
      rows
        .filter((row) => selectedIds.includes(row.uniqueId))
        .map((row) => ({ id: row.sourceId, type: row.rebutType })),
    [rows, selectedIds]
  );

  const handleApplyFilters = () => {
    setAppliedFilters({
      ...draftFilters,
      searchText: draftFilters.searchText?.trim() || '',
    });
    setPage(1);
  };

  const handleResetFilters = () => {
    const reset: UnifiedRebutFilters = {
      startDate: '',
      endDate: '',
      rebutType: '',
      chaineId: '',
      bottleFilter: false,
      searchText: '',
      showLocked: false,
    };
    setDraftFilters(reset);
    setAppliedFilters(reset);
    setPageSize(25);
    setPage(1);
    setSelectedIds([]);
  };

  const openDateRangeModal = () => {
    const start = draftFilters.startDate ? new Date(`${draftFilters.startDate}T00:00:00`) : new Date();
    const end = draftFilters.endDate ? new Date(`${draftFilters.endDate}T00:00:00`) : start;
    setModalDateRange({ startDate: start, endDate: end, key: 'selection' });
    setDateRangeModalOpen(true);
  };

  const applyDateRange = () => {
    setDraftFilters((prev) => ({
      ...prev,
      startDate: format(modalDateRange.startDate, 'yyyy-MM-dd'),
      endDate: format(modalDateRange.endDate, 'yyyy-MM-dd'),
    }));
    setDateRangeModalOpen(false);
  };

  const handleExportExcel = async () => {
    try {
      const blob = await unifiedRebutReportApi.exportAllBlob(appliedFilters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rebuts_unifies_${Date.now()}.xls`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export Excel téléchargé.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l’export Excel.');
    }
  };

  const handlePrint = async () => {
    try {
      const blob = await unifiedRebutReportApi.exportPrintBlob(appliedFilters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rebuts_unifies_${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF généré.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la préparation impression.');
    }
  };

  if (roleLoading || !canAccess) {
    return (
      <DashboardLayout>
        <div className="p-6">{!canAccess ? 'Accès non autorisé.' : 'Chargement...'}</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rapport rebut unifié</h1>
          <p className="text-sm text-muted-foreground">Administration / Rebuts Unifiés</p>
        </div>

        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Filter className="h-4 w-4" />
                Filtres
                {activeFilterCount > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    ({activeFilterCount} actif{activeFilterCount > 1 ? 's' : ''})
                  </span>
                ) : null}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleResetFilters}
                >
                  Effacer les filtres
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/20 p-3">
              <div className="min-w-[260px] flex-1">
                <Label className="mb-1 block text-xs font-medium text-muted-foreground">Rechercher</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={draftFilters.searchText || ''}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, searchText: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleApplyFilters();
                    }}
                    placeholder="OFID, produit, composant, défaut, commentaire"
                    className="pl-8"
                  />
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                className="bg-[#4472C4] hover:bg-[#3a62a8]"
                onClick={handleApplyFilters}
              >
                Appliquer
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleResetFilters}>
                Reset
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => refetch()}
                disabled={isRefetching}
                aria-label="Actualiser"
              >
                <RefreshCw className={cn('h-4 w-4', isRefetching && 'animate-spin')} />
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="min-w-0">
                <Label className="mb-1 block text-xs font-medium text-muted-foreground">Date de création</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-full justify-start gap-2 font-normal text-xs"
                  onClick={openDateRangeModal}
                >
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {draftFilters.startDate && draftFilters.endDate
                      ? `${format(new Date(`${draftFilters.startDate}T00:00:00`), 'dd/MM/yyyy', { locale: fr })} – ${format(new Date(`${draftFilters.endDate}T00:00:00`), 'dd/MM/yyyy', { locale: fr })}`
                      : 'Choisir une période'}
                  </span>
                </Button>
              </div>
              <div className="min-w-0">
                <Label className="mb-1 block text-xs font-medium text-muted-foreground">Type</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={draftFilters.rebutType || ''}
                  onChange={(e) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      rebutType: e.target.value as UnifiedRebutType | '',
                    }))
                  }
                >
                  {(typeData?.data || []).map((opt) => (
                    <option key={opt.value || 'all'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <Label className="mb-1 block text-xs font-medium text-muted-foreground">Chaîne</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={draftFilters.chaineId || ''}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, chaineId: e.target.value }))}
                >
                  <option value="">Toutes</option>
                  {(chainesData?.data || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.num_chaine}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <Label className="mb-1 block text-xs font-medium text-muted-foreground">Lignes/page</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={String(pageSize)}
                  onChange={(e) => {
                    const next = Number.parseInt(e.target.value, 10);
                    setPageSize(next);
                    setPage(1);
                  }}
                >
                  {PAGE_OPTIONS.map((n) => (
                    <option key={String(n)} value={String(n)}>
                      {n === -1 ? 'Toutes' : n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2 rounded-md border bg-background px-3 py-2 sm:col-span-2 xl:col-span-2">
                <Label className="text-xs font-medium text-muted-foreground">Options</Label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={!!draftFilters.showLocked}
                    onCheckedChange={(checked) =>
                      setDraftFilters((prev) => ({ ...prev, showLocked: !!checked }))
                    }
                  />
                  <span>Afficher entrées validées</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={!!draftFilters.bottleFilter}
                    onCheckedChange={(checked) =>
                      setDraftFilters((prev) => ({ ...prev, bottleFilter: !!checked }))
                    }
                  />
                  <span>Flacon</span>
                </label>
              </div>
            </div>

            <Dialog open={dateRangeModalOpen} onOpenChange={setDateRangeModalOpen}>
              <DialogContent className="max-w-[min(100vw-2rem,28rem)] sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Date de création</DialogTitle>
                  <DialogDescription>
                    Sélectionnez la date de début et la date de fin pour filtrer les entrées.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-center overflow-x-auto py-1">
                  <DateRange
                    ranges={[modalDateRange]}
                    onChange={(ranges: { selection?: typeof modalDateRange }) => {
                      if (ranges?.selection) {
                        setModalDateRange({
                          ...ranges.selection,
                          key: 'selection',
                        });
                      }
                    }}
                    editableDateInputs={true}
                    months={1}
                    locale={fr}
                  />
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button type="button" variant="outline" onClick={() => setDateRangeModalOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="button" onClick={applyDateRange}>
                    Appliquer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-4 py-3">
            <div className="text-sm">{selectedIds.length} entrée(s) sélectionnée(s)</div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                className="bg-green-600 text-white hover:bg-green-700"
                onClick={() => bulkValidateMutation.mutate(selectedEntries)}
                disabled={bulkValidateMutation.isPending}
              >
                <Check className="mr-2 h-4 w-4" />
                Valider la sélection
              </Button>
              <Button type="button" variant="outline" onClick={() => setSelectedIds([])}>
                Annuler
              </Button>
            </div>
          </div>
        )}

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Données unifiées</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="bg-green-600 text-white hover:bg-green-700"
                  onClick={handleExportExcel}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Excel
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
                  <FileBarChart className="mr-2 h-4 w-4" />
                  Imprimer
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#b4b0b0] text-[10px] uppercase text-[#212529]">
                    <th className="border p-2 text-center">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedIds(unlockedRows.map((r) => r.uniqueId));
                          else setSelectedIds([]);
                        }}
                      />
                    </th>
                    <th className="border p-2 text-left">Type</th>
                    <th className="border p-2 text-left">
                      <button
                        className="font-inherit"
                        onClick={() => {
                          setSortColumn('date_declaration');
                          setSortDirection((prev) => nextSort(prev));
                        }}
                      >
                        Date
                      </button>
                    </th>
                    <th className="border p-2 text-left">OFID</th>
                    <th className="border p-2 text-left">Produit</th>
                    <th className="border p-2 text-right">Qty</th>
                    <th className="border p-2 text-left">Composant</th>
                    <th className="border p-2 text-left">Défaut</th>
                    <th className="border p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td className="border p-3 text-center" colSpan={9}>
                        Chargement...
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td className="border p-3 text-center" colSpan={9}>
                        Aucune donnée.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const locked = !row.status;
                      const typeStyle = TYPE_STYLE[row.rebutType];
                      return (
                        <tr
                          key={row.uniqueId}
                          className={cn(
                            'border-b',
                            locked && 'bg-[#f8f9fa] text-[#6c757d] opacity-80'
                          )}
                        >
                          <td className="border p-2 text-center">
                            {row.status && row.rebutType !== 'conformity' ? (
                              <Checkbox
                                checked={selectedIds.includes(row.uniqueId)}
                                onCheckedChange={(checked) => {
                                  setSelectedIds((prev) =>
                                    checked
                                      ? [...prev, row.uniqueId]
                                      : prev.filter((id) => id !== row.uniqueId)
                                  );
                                }}
                              />
                            ) : null}
                          </td>
                          <td className="border p-2">
                            <span className={cn('rounded px-2 py-1 text-xs font-medium', typeStyle.className)}>
                              {typeStyle.label}
                            </span>
                          </td>
                          <td className="border p-2">{formatDateOnly(row.dateDeclaration)}</td>
                          <td className="border p-2">{row.OFID || 'N/A'}</td>
                          <td className="border p-2">{row.produit || 'N/A'}</td>
                          <td className="border p-2 text-right">{row.quantity}</td>
                          <td className="border p-2">{row.component || 'N/A'}</td>
                          <td className="border p-2">{row.defect || 'N/A'}</td>
                          <td className="border p-2">
                            <div className="flex items-center gap-2">
                              {row.status && row.rebutType !== 'conformity' ? (
                                <>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    onClick={() =>
                                      validateSingleMutation.mutate({
                                        id: row.sourceId,
                                        type: row.rebutType,
                                      })
                                    }
                                    title="Valider"
                                  >
                                    <Check className="h-4 w-4 text-green-600" />
                                  </Button>
                                  {row.rebutType === 'hors_prod' ? (
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="outline"
                                      onClick={() => navigate(`/components/waste/${row.sourceId}/edit`)}
                                      title="Modifier"
                                    >
                                      <Pencil className="h-4 w-4 text-amber-500" />
                                    </Button>
                                  ) : null}
                                </>
                              ) : (
                                <Button type="button" size="icon" variant="outline" disabled title="Verrouillé">
                                  <Lock className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40">
                    <td className="border p-2" colSpan={5}></td>
                    <td className="border p-2 text-right font-semibold">{currentQtyTotal}</td>
                    <td className="border p-2" colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {total} ligne(s) au total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || pageSize === -1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Précédent
                </Button>
                <span className="text-sm">
                  Page {page} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || pageSize === -1}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Suivant
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

