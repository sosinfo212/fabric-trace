'use client';

import { Component, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Plus, Loader2, ClipboardList, RefreshCw, Filter, Settings2, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { componentChangesApi, type ComponentChangeWithProducts, type FabOrderOption } from '@/lib/api';
import { ComponentChangesTable } from './ComponentChangesTable';
import { ComponentChangeModal } from './ComponentChangeModal';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const SEARCH_COLUMNS: Record<string, string> = {
  of: 'OF',
  commande: 'Commande',
  produit: 'Produit',
  composant_original: 'Composant original',
  nouveau_composant: 'Nouveau composant',
  statut: 'Statut',
  date: 'Date',
};

const ROW_FIELD_BY_KEY: Record<string, keyof ComponentChangeWithProducts> = {
  of: 'ofId',
  commande: 'commande',
  produit: 'nomDuProduit',
  composant_original: 'originalComponentName',
  nouveau_composant: 'newComponentName',
  statut: 'status',
  date: 'createdAt',
};

class ModalErrorBoundary extends Component<{ onClose: () => void; children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('ComponentChangeModal error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-lg border bg-background p-6 shadow-lg max-w-md">
            <p className="text-destructive font-medium">Une erreur s&apos;est produite lors de l&apos;ouverture du formulaire.</p>
            <Button className="mt-4" onClick={() => { this.setState({ hasError: false }); this.props.onClose(); }}>
              Fermer
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ComponentChangesPage() {
  const { loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();
  const canAccess = hasMenuAccess('/component-changes');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editRow, setEditRow] = useState<ComponentChangeWithProducts | null>(null);

  const [searchByColumn, setSearchByColumn] = useState<Record<string, string>>({});
  const [searchInColumns, setSearchInColumns] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    Object.keys(SEARCH_COLUMNS).forEach((k) => (o[k] = true));
    return o;
  });

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['component-changes'],
    queryFn: async () => {
      const res = await componentChangesApi.getAll();
      return res.data;
    },
    enabled: !!canAccess,
  });

  const { data: fabOrdersData } = useQuery({
    queryKey: ['component-changes-of-list'],
    queryFn: async () => {
      const res = await componentChangesApi.getOFList();
      return res.data ?? [];
    },
    enabled: !!canAccess,
    staleTime: 60_000,
  });

  const rows: ComponentChangeWithProducts[] = data ?? [];
  const fabOrdersRaw: FabOrderOption[] = fabOrdersData ?? [];
  const fabOrders = useMemo(() => {
    const list = [...fabOrdersRaw];
    if (editRow && !list.some((o) => o.OFID === editRow.ofId)) {
      list.unshift({ OFID: editRow.ofId, saleOrderId: editRow.commande, prodName: editRow.nomDuProduit });
    }
    return list;
  }, [fabOrdersRaw, editRow]);

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
        const field = ROW_FIELD_BY_KEY[key];
        const cell = field ? (r as Record<string, unknown>)[field] : undefined;
        if (cell == null && key !== 'date') return false;
        if (key === 'date') {
          const d = r.createdAt ? new Date(r.createdAt) : null;
          if (!d || isNaN(d.getTime())) return false;
          const rowDate = format(d, 'yyyy-MM-dd');
          return rowDate === val;
        }
        return String(cell).toLowerCase().includes(val.toLowerCase());
      })
    );
  }, [rows, searchByColumn, activeSearchKeys]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return db - da;
    });
  }, [filteredRows]);

  const handleEdit = (row: ComponentChangeWithProducts) => {
    setEditRow(row);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setModalMode('create');
    setEditRow(null);
  };

  if (authLoading || roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!canAccess) {
    return (
      <DashboardLayout>
        <div className="p-4 text-destructive">Vous n'avez pas accès à cette page.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestion des Composants</h1>
            <p className="text-muted-foreground text-sm">/ Changement des composants</p>
          </div>
          <Button onClick={() => { setModalMode('create'); setEditRow(null); setModalOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter
          </Button>
        </div>

        {/* Filters card — same pattern as /injection/declaration */}
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
                  <Label className="text-xs text-muted-foreground truncate">{SEARCH_COLUMNS[key]}</Label>
                  {key === 'date' ? (
                    <Input
                      type="date"
                      value={searchByColumn[key] ?? ''}
                      onChange={(e) => setSearchByColumn((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="h-9 w-full min-w-0"
                    />
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

        {/* List card — same pattern as /planning/orders */}
        <Card>
          <CardHeader>
            <div className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Liste des changements de composants
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {filteredRows.length} changement(s)
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isRefetching}>
                <RefreshCw className={cn('h-4 w-4', isRefetching && 'animate-spin')} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className={cn('h-8 w-8 animate-spin text-muted-foreground')} />
              </div>
            ) : (
              <ComponentChangesTable
                data={sortedRows}
                onRefresh={() => refetch()}
                onEdit={handleEdit}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {modalOpen && (
        <ModalErrorBoundary onClose={handleCloseModal}>
          <ComponentChangeModal
            open
            onClose={handleCloseModal}
            mode={modalMode}
            editData={editRow}
            fabOrders={Array.isArray(fabOrders) ? fabOrders : []}
            onSuccess={() => refetch()}
          />
        </ModalErrorBoundary>
      )}
    </DashboardLayout>
  );
}
