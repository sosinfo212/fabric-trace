'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DateRange } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { wasteHorsProdApi, type RebutHorsProdRow } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';
import {
  Calendar,
  Check,
  ChevronDown,
  Download,
  Filter,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  Unlock,
} from 'lucide-react';

function formatDateTime(d: string | Date | null | undefined) {
  if (!d) return '—';
  const date = new Date(d);
  return isNaN(date.getTime()) ? '—' : format(date, 'dd/MM/yyyy HH:mm', { locale: fr });
}

const STATUS_OPTIONS = ['Déverrouillé', 'Verrouillé'] as const;

const SEARCH_COLUMNS: Record<string, string> = {
  createdAtRange: 'Date de Création',
  demandeur: 'Demandeur',
  produit: 'Produit',
  composant: 'Composant',
  qty: 'Quantité',
  defaut: 'Défaut',
  comment: 'Commentaire',
  createdBy: 'Créé par',
  status: 'Statut',
};

export default function WasteHorsProdIndex() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();
  const canAccess = hasMenuAccess('/components/waste');

  const [page] = useState(1);
  const [pageSize] = useState(100);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchByColumn, setSearchByColumn] = useState<Record<string, string>>({});
  const [dateFilterApplied, setDateFilterApplied] = useState(false);
  const [dateRange, setDateRange] = useState<{ startDate: Date; endDate: Date; key: 'selection' }>(() => {
    const now = new Date();
    return { startDate: now, endDate: now, key: 'selection' };
  });
  const [dateRangeModalOpen, setDateRangeModalOpen] = useState(false);
  const [modalDateRange, setModalDateRange] = useState<{
    startDate: Date;
    endDate: Date;
    key: 'selection';
  }>(() => {
    const now = new Date();
    return { startDate: now, endDate: now, key: 'selection' };
  });
  const [searchInColumns, setSearchInColumns] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    Object.keys(SEARCH_COLUMNS).forEach((k) => (o[k] = true));
    // Hide these filters by default (they are still available via "Colonnes")
    o.demandeur = false;
    o.comment = false;
    o.qty = false;
    return o;
  });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [rowLoadingIds, setRowLoadingIds] = useState<Record<number, boolean>>({});

  // Keep the legacy "createdAtRange" string filter in sync with the date picker range.
  useEffect(() => {
    const startStr = dateRange.startDate ? format(dateRange.startDate, 'yyyy-MM-dd') : '';
    const endStr = dateRange.endDate ? format(dateRange.endDate, 'yyyy-MM-dd') : '';
    if (!dateFilterApplied) {
      setSearchByColumn((prev) => (prev.createdAtRange ? { ...prev, createdAtRange: '' } : prev));
      return;
    }
    const next = !startStr && !endStr ? '' : `${startStr},${endStr}`;
    setSearchByColumn((prev) => {
      if ((prev.createdAtRange ?? '') === next) return prev;
      return { ...prev, createdAtRange: next };
    });
  }, [dateRange.startDate, dateRange.endDate, dateFilterApplied]);

  const openDateRangeModal = () => {
    setModalDateRange({
      startDate: new Date(dateRange.startDate),
      endDate: new Date(dateRange.endDate),
      key: 'selection',
    });
    setDateRangeModalOpen(true);
  };

  const applyModalDateRange = () => {
    setDateRange({
      startDate: new Date(modalDateRange.startDate),
      endDate: new Date(modalDateRange.endDate),
      key: 'selection',
    });
    setDateFilterApplied(true);
    setDateRangeModalOpen(false);
  };

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['waste-hors-prod', page, pageSize],
    queryFn: async () => {
      const res = await wasteHorsProdApi.getData({
        showValidated: true,
        page,
        pageSize,
      });
      return res;
    },
    enabled: !!canAccess,
    staleTime: 30_000,
  });

  const rows = (data?.data ?? []) as RebutHorsProdRow[];

  const activeSearchKeys = useMemo(
    () => Object.keys(SEARCH_COLUMNS).filter((k) => searchInColumns[k]),
    [searchInColumns]
  );

  const filteredRows = useMemo(() => {
    let list = rows;
    const criteria = activeSearchKeys
      .map((key) => {
        const val = searchByColumn[key]?.trim();
        return val ? { key, val } : null;
      })
      .filter(Boolean) as Array<{ key: string; val: string }>;

    if (criteria.length === 0) return list;

    return list.filter((r) =>
      criteria.every(({ key, val }) => {
        if (key === 'status') {
          const selected = val
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          if (selected.length === 0) return true;
          const label = r.status ? 'Déverrouillé' : 'Verrouillé';
          return selected.includes(label);
        }

        if (key === 'createdAtRange') {
          const input = val;
          if (!input) return true;

          const [startRaw, endRaw] = input.split(',');
          const start = startRaw || '';
          const end = endRaw || '';

          const d = new Date(r.createdAt);
          if (isNaN(d.getTime())) return false;
          const rowDate = format(d, 'yyyy-MM-dd');

          if (start && rowDate < start) return false;
          if (end && rowDate > end) return false;
          return true;
        }

        const cell = (r as Record<string, unknown>)[key];
        if (cell == null) return false;
        return String(cell).toLowerCase().includes(val.toLowerCase());
      })
    );
  }, [rows, activeSearchKeys, searchByColumn]);

  const unlockedOnPage = useMemo(() => filteredRows.filter((r) => r.status), [filteredRows]);

  useEffect(() => {
    // Drop selections that are no longer visible/unlocked.
    setSelectedIds((prev) => prev.filter((id) => unlockedOnPage.some((r) => r.id === id)));
  }, [unlockedOnPage]);

  const sumQty = useMemo(() => filteredRows.reduce((s, r) => s + (r.qty ?? 0), 0), [filteredRows]);

  const allSelected = unlockedOnPage.length > 0 && unlockedOnPage.every((r) => selectedIds.includes(r.id));

  const handleToggleSelectAll = () => {
    if (unlockedOnPage.length === 0) return;
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(unlockedOnPage.map((r) => r.id));
    }
  };

  const bulkValidateMutation = useMutation({
    mutationFn: async () => {
      if (selectedIds.length === 0) return;
      return wasteHorsProdApi.bulkValidate(selectedIds);
    },
    onSuccess: async (res) => {
      toast.success(`Validation terminée: ${res.validated} validée(s), ${res.alreadyLocked} déjà verrouillée(s).`);
      setSelectedIds([]);
      await queryClient.invalidateQueries({ queryKey: ['waste-hors-prod'] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la validation en masse.');
    },
    onSettled: () => setBulkLoading(false),
  });

  const validateRowMutation = useMutation({
    mutationFn: async (id: number) => wasteHorsProdApi.validate(id),
    onSuccess: async () => {
      toast.success('Entrée verrouillée.');
      await refetch();
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la validation.');
    },
    onSettled: (_data, _error, id) => {
      setRowLoadingIds((prev) => ({ ...prev, [id as number]: false }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => wasteHorsProdApi.delete(id),
    onSuccess: async () => {
      toast.success('Rebut supprimé.');
      setDeleteId(null);
      await refetch();
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    },
  });

  const handleCopy = async () => {
    try {
      const startStr = dateFilterApplied ? format(dateRange.startDate, 'yyyy-MM-dd') : '';
      const endStr = dateFilterApplied ? format(dateRange.endDate, 'yyyy-MM-dd') : '';
      const statusVal = searchByColumn.status ?? '';
      const selectedStatuses = statusVal.split(',').map((s) => s.trim()).filter(Boolean);

      let statusFilter: 'unlocked' | 'locked' | 'all' = 'all';
      if (selectedStatuses.length === 1) {
        if (selectedStatuses[0] === 'Déverrouillé') statusFilter = 'unlocked';
        if (selectedStatuses[0] === 'Verrouillé') statusFilter = 'locked';
      }

      const csvText = await wasteHorsProdApi.exportCsvText({
        showValidated: true,
        startDate: startStr || undefined,
        endDate: endStr || undefined,
        statusFilter,
      });
      await navigator.clipboard.writeText(csvText);
      toast.success('CSV copié dans le presse-papiers.');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la copie.');
    }
  };

  const handleExportExcel = async () => {
    try {
      const startStr = dateFilterApplied ? format(dateRange.startDate, 'yyyy-MM-dd') : '';
      const endStr = dateFilterApplied ? format(dateRange.endDate, 'yyyy-MM-dd') : '';
      const statusVal = searchByColumn.status ?? '';
      const selectedStatuses = statusVal.split(',').map((s) => s.trim()).filter(Boolean);

      let statusFilter: 'unlocked' | 'locked' | 'all' = 'all';
      if (selectedStatuses.length === 1) {
        if (selectedStatuses[0] === 'Déverrouillé') statusFilter = 'unlocked';
        if (selectedStatuses[0] === 'Verrouillé') statusFilter = 'locked';
      }

      const blob = await wasteHorsProdApi.exportCsvBlob({
        showValidated: true,
        startDate: startStr || undefined,
        endDate: endStr || undefined,
        statusFilter,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rebuts_hors_production_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export téléchargé.');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de l’export.');
    }
  };

  if (authLoading || roleLoading || !canAccess) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[200px]">
          {!canAccess ? <p>Accès non autorisé.</p> : <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Rebuts Hors Production</h1>
            <p className="text-sm text-muted-foreground">Administration / Rebuts hors production</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              aria-label="Actualiser"
            >
              <RefreshCw className={cn('h-4 w-4', isRefetching && 'animate-spin')} />
            </Button>
            <Button
              onClick={() => navigate('/components/waste/create')}
              className="bg-gradient-to-r from-[#28a745] to-[#20c997] text-white hover:shadow-lg"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nouveau Rebut
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Filtres</CardTitle>
                {(() => {
                  const activeCount = activeSearchKeys.filter((k) => (searchByColumn[k] ?? '').trim() !== '').length;
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
                      if (activeSearchKeys.includes('createdAtRange')) {
                        setDateFilterApplied(false);
                        const now = new Date();
                        setDateRange({ startDate: now, endDate: now, key: 'selection' });
                        setModalDateRange({ startDate: now, endDate: now, key: 'selection' });
                        setDateRangeModalOpen(false);
                      }
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
                        <Button variant="outline" size="sm" className="h-9 w-full justify-between font-normal text-xs">
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
                                  onCheckedChange={(checkedValue) => {
                                    const next = checkedValue
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
                  ) : key === 'createdAtRange' ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 w-full justify-start gap-2 font-normal text-xs"
                        onClick={openDateRangeModal}
                      >
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">
                          {dateFilterApplied
                            ? `${format(dateRange.startDate, 'dd/MM/yyyy', { locale: fr })} – ${format(dateRange.endDate, 'dd/MM/yyyy', { locale: fr })}`
                            : 'Choisir une période'}
                        </span>
                      </Button>
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
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setDateRangeModalOpen(false)}
                            >
                              Annuler
                            </Button>
                            <Button type="button" onClick={applyModalDateRange}>
                              Appliquer
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </>
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

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                <Download className="mr-2 h-4 w-4" />
                Copier
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleExportExcel}
                className="bg-gradient-to-r from-[#28a745] to-[#20c997] text-white hover:shadow-lg"
              >
                <Download className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimer
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bulk actions */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between gap-4 bg-muted/30 rounded-md border px-4 py-3">
            <div className="text-sm">
              {selectedIds.length} entrée(s) sélectionnée(s)
            </div>
            <div className="flex items-center gap-2">
              <Button
                disabled={bulkLoading}
                className="bg-gradient-to-r from-[#28a745] to-[#20c997] text-white hover:shadow-lg"
                onClick={() => {
                  setBulkLoading(true);
                  bulkValidateMutation.mutate();
                }}
              >
                <Check className="mr-2 h-4 w-4" />
                Valider la sélection
              </Button>
              <Button variant="outline" onClick={() => setSelectedIds([])}>
                Annuler
              </Button>
            </div>
          </div>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Liste des rebuts hors production</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredRows.length} ligne(s) — Quantité page: <span className="font-medium">{sumQty}</span>
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">Aucune entrée.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={() => handleToggleSelectAll()}
                          aria-label="Sélectionner tout"
                          disabled={unlockedOnPage.length === 0}
                        />
                      </TableHead>
                      <TableHead>Date de Création</TableHead>
                      <TableHead>Demandeur</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead>Composant</TableHead>
                      <TableHead>Quantité</TableHead>
                      <TableHead>Défaut</TableHead>
                      <TableHead>Commentaire</TableHead>
                      <TableHead>Créé par</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right w-[140px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row) => {
                      const isUnlocked = row.status;
                      const isSelected = selectedIds.includes(row.id);
                      return (
                        <TableRow
                          key={row.id}
                          className={!isUnlocked ? 'bg-[#f8f9fa] opacity-80 text-[#6c757d]' : undefined}
                        >
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(v) => {
                                if (!isUnlocked) return;
                                setSelectedIds((prev) => (v ? Array.from(new Set([...prev, row.id])) : prev.filter((x) => x !== row.id)));
                              }}
                              disabled={!isUnlocked}
                              aria-label={`Sélection ${row.id}`}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{formatDateTime(row.createdAt)}</TableCell>
                          <TableCell>{row.demandeur ?? '—'}</TableCell>
                          <TableCell>{row.produit}</TableCell>
                          <TableCell>{row.composant}</TableCell>
                          <TableCell>{row.qty}</TableCell>
                          <TableCell>{row.defaut}</TableCell>
                          <TableCell className="max-w-[250px] truncate">
                            {row.comment ? (row.comment.length > 50 ? `${row.comment.slice(0, 50)}...` : row.comment) : 'Aucun commentaire'}
                          </TableCell>
                          <TableCell>{row.createdBy ?? '—'}</TableCell>
                          <TableCell>
                            <span className={isUnlocked ? 'inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-800 text-xs' : 'inline-flex items-center px-2 py-1 rounded bg-red-100 text-red-800 text-xs'}>
                              {isUnlocked ? 'Déverrouillé' : 'Verrouillé'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isUnlocked ? (
                                <>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8"
                                    disabled={!!rowLoadingIds[row.id]}
                                    onClick={() => {
                                      setRowLoadingIds((prev) => ({ ...prev, [row.id]: true }));
                                      validateRowMutation.mutate(row.id);
                                    }}
                                    aria-label="Valider"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8"
                                    onClick={() => navigate(`/components/waste/${row.id}/edit`)}
                                    aria-label="Modifier"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => setDeleteId(row.id)}
                                    aria-label="Supprimer"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 opacity-50 cursor-not-allowed"
                                  disabled
                                  aria-label="Verrouillé"
                                >
                                  <Lock className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => navigate(`/components/waste/${row.id}`)}
                                aria-label="Voir"
                              >
                                <Unlock className="h-4 w-4 opacity-50" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
              <AlertDialogDescription>Voulez-vous vraiment supprimer ce rebut ?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (deleteId != null) deleteMutation.mutate(deleteId);
                }}
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

