import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { serigraphieOrdersApi, type SerigraphieOrderRow } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Pencil, Loader2, RefreshCw, Filter, Settings2, ChevronDown, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const PAGE_SIZE = 100;

const STATUT_OPTIONS = ['Planifié', 'Préparé', 'En cours', 'Réalisé', 'Suspendu', 'Cloturé'] as const;

function getPriority(row: SerigraphieOrderRow): number | undefined {
  const r = row as SerigraphieOrderRow & { priority?: number };
  return r.Priority ?? r.priority;
}

const STATUT_BADGE_CLASS: Record<string, string> = {
  Planifié: 'bg-blue-100 text-blue-800 border-blue-200',
  Préparé: 'bg-slate-100 text-slate-800 border-slate-200',
  'En cours': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Réalisé: 'bg-green-100 text-green-800 border-green-200',
  Suspendu: 'bg-red-100 text-red-800 border-red-200',
  Cloturé: 'bg-cyan-100 text-cyan-800 border-cyan-200',
};

const SEARCH_COLUMNS: Record<string, string> = {
  client: 'Client (désignation)',
  commande: 'Commande',
  OFID: 'OFID',
  prod_des: 'Produit',
  date_planifie: 'Date planifiée',
  statut: 'Statut',
  instruction: 'Instruction',
};

export default function WarehousePlanningPage() {
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();
  const canAccess = hasMenuAccess('/serigraphie/warehouse-planning');

  const [searchByColumn, setSearchByColumn] = useState<Record<string, string>>({});
  const [searchInColumns, setSearchInColumns] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    Object.keys(SEARCH_COLUMNS).forEach((k) => (o[k] = true));
    return o;
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<SerigraphieOrderRow | null>(null);
  const [statut, setStatut] = useState('');
  const [qte_reel, setQte_reel] = useState('');

  const { data: rows = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['serigraphie-orders'],
    queryFn: () => serigraphieOrdersApi.getList(),
    enabled: !!user && canAccess,
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
        if (key === 'date_planifie') return String(cell).slice(0, 10) === val;
        if (key === 'statut') {
          const selected = val.split(',').map((s) => s.trim()).filter(Boolean);
          return selected.length > 0 && selected.includes(String(cell));
        }
        return String(cell).toLowerCase().includes(val.toLowerCase());
      })
    );
  }, [rows, searchByColumn, activeSearchKeys]);

  const displayRows = filteredRows.slice(0, PAGE_SIZE);

  const updateMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      OFID: string;
      prod_ref: string | null;
      prod_des: string | null;
      client: string | null;
      commande: string | null;
      qte_plan: number;
      qte_reel: number;
      statut: string;
      date_planifie: string;
      instruction: string | null;
      comment: string | null;
      priority: number;
    }) =>
      serigraphieOrdersApi.store({
        id: payload.id,
        OFID: payload.OFID,
        prod_ref: payload.prod_ref,
        prod_des: payload.prod_des,
        client: payload.client,
        commande: payload.commande,
        qte_plan: payload.qte_plan,
        qte_reel: payload.qte_reel,
        statut: payload.statut,
        date_planifie: payload.date_planifie,
        instruction: payload.instruction,
        comment: payload.comment,
        priority: payload.priority ?? 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serigraphie-orders'] });
      toast({ title: 'Statut / quantité enregistrés.' });
      setModalOpen(false);
      setEditingRow(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    },
  });

  const openEdit = async (row: SerigraphieOrderRow) => {
    try {
      const one = await serigraphieOrdersApi.getOne(row.id);
      setEditingRow(one);
      setStatut(one.statut ?? 'Planifié');
      setQte_reel(String(one.qte_reel ?? ''));
      setModalOpen(true);
    } catch (e) {
      toast({ title: 'Erreur', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;
    const qteReelNum = qte_reel === '' ? 0 : Number(qte_reel);
    if (!Number.isFinite(qteReelNum) || qteReelNum < 0) {
      toast({ title: 'Quantité préparé invalide.', variant: 'destructive' });
      return;
    }
    updateMutation.mutate({
      id: editingRow.id,
      OFID: editingRow.OFID ?? '',
      prod_ref: editingRow.prod_ref ?? null,
      prod_des: editingRow.prod_des ?? null,
      client: editingRow.client ?? null,
      commande: editingRow.commande ?? null,
      qte_plan: editingRow.qte_plan ?? 0,
      qte_reel: qteReelNum,
      statut,
      date_planifie: editingRow.date_planifie ? String(editingRow.date_planifie).slice(0, 10) : '',
      instruction: editingRow.instruction ?? null,
      comment: editingRow.comment ?? null,
      priority: getPriority(editingRow) ?? 0,
    });
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try {
      return format(new Date(d), 'dd/MM/yyyy');
    } catch {
      return '—';
    }
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
  if (!user || !canAccess) {
    return <Navigate to="/" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Préparation pré-prod</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            aria-label="Actualiser"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
              {activeSearchKeys.map((key) => (
                <div key={key} className="flex flex-col gap-1.5 min-w-0">
                  <Label className="text-xs text-muted-foreground truncate">
                    {SEARCH_COLUMNS[key]}
                  </Label>
                  {key === 'date_planifie' ? (
                    <Input
                      type="date"
                      value={searchByColumn[key] ?? ''}
                      onChange={(e) =>
                        setSearchByColumn((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="h-9 w-full min-w-0"
                    />
                  ) : key === 'statut' ? (
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
                          {STATUT_OPTIONS.map((s) => {
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
          <CardHeader>
            <CardTitle className="text-base">Liste des ordres</CardTitle>
            <p className="text-sm text-muted-foreground">
              {filteredRows.length} ordre(s){' '}
              {filteredRows.length > PAGE_SIZE ? `(affichage des ${PAGE_SIZE} premiers)` : ''}
            </p>
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
                      <TableHead>Client (désignation)</TableHead>
                      <TableHead>Commande</TableHead>
                      <TableHead>OFID</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead>Date Planifiée</TableHead>
                      <TableHead className="text-right">Quantité Planifiée</TableHead>
                      <TableHead className="text-right">Quantité Préparé</TableHead>
                      <TableHead className="text-right">Priorité</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="max-w-[200px]">Instruction</TableHead>
                      <TableHead className="w-[80px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                          Aucun ordre pour les filtres sélectionnés.
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.client ?? '—'}</TableCell>
                          <TableCell>{row.commande ?? '—'}</TableCell>
                          <TableCell className="font-mono">{row.OFID}</TableCell>
                          <TableCell>{row.prod_des ?? '—'}</TableCell>
                          <TableCell>{formatDate(row.date_planifie)}</TableCell>
                          <TableCell className="text-right">{row.qte_plan}</TableCell>
                          <TableCell className="text-right">{row.qte_reel}</TableCell>
                          <TableCell className="text-right">
                            {getPriority(row) ?? '—'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={STATUT_BADGE_CLASS[row.statut] ?? 'bg-muted'}
                            >
                              {row.statut}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {row.instruction ?? '—'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(row)}
                              aria-label="Modifier"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
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

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mettre à jour le statut / quantité</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {editingRow && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Référence OF</Label>
                    <Input value={editingRow.OFID ?? ''} readOnly disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Client (désignation)</Label>
                    <Input value={editingRow.client ?? ''} readOnly disabled className="bg-muted" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Produit</Label>
                  <Input value={editingRow.prod_des ?? ''} readOnly disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Commande</Label>
                  <Input value={editingRow.commande ?? ''} readOnly disabled className="bg-muted" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quantité Planifiée</Label>
                    <Input
                      type="number"
                      value={editingRow.qte_plan ?? ''}
                      readOnly
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qte_reel">Quantité Préparé *</Label>
                    <Input
                      id="qte_reel"
                      type="number"
                      min={0}
                      value={qte_reel}
                      onChange={(e) => setQte_reel(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Statut</Label>
                    <Select value={statut} onValueChange={setStatut}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUT_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date Planifiée</Label>
                    <Input
                      value={
                        editingRow.date_planifie
                          ? formatDate(editingRow.date_planifie)
                          : '—'
                      }
                      readOnly
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Instruction</Label>
                  <Textarea
                    value={editingRow.instruction ?? ''}
                    readOnly
                    disabled
                    rows={2}
                    className="bg-muted resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Commentaire</Label>
                  <Textarea
                    value={editingRow.comment ?? ''}
                    readOnly
                    disabled
                    rows={2}
                    className="bg-muted resize-none"
                  />
                </div>
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
