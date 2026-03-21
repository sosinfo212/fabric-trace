import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  serigraphieOrdersApi,
  type SerigraphieOrderRow,
  type SerigraphieDropdowns,
  type SerigraphieImportRow,
} from '@/lib/api';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Plus, Pencil, Trash2, Loader2, RefreshCw, Upload, Download, Search, Settings2, ChevronDown, Filter } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

const PAGE_SIZE = 100;

const STATUT_OPTIONS = ['Planifié', 'En cours', 'Préparé', 'Réalisé', 'Suspendu', 'Cloturé'] as const;

const STATUT_BADGE_CLASS: Record<string, string> = {
  Planifié: 'bg-blue-100 text-blue-800 border-blue-200',
  'En cours': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Préparé: 'bg-slate-100 text-slate-800 border-slate-200',
  Réalisé: 'bg-green-100 text-green-800 border-green-200',
  Suspendu: 'bg-red-100 text-red-800 border-red-200',
  Cloturé: 'bg-cyan-100 text-cyan-800 border-cyan-200',
};

// Searchable columns (key -> label); used for configurable search like Odoo
const SEARCH_COLUMNS: Record<string, string> = {
  client: 'Client (désignation)',
  commande: 'Commande',
  OFID: 'OFID',
  prod_des: 'Produit',
  date_planifie: 'Date planifiée',
  statut: 'Statut',
  instruction: 'Instruction',
};

const defaultForm = {
  OFID: '',
  client: '',
  prod_ref: '',
  prod_des: '',
  commande: '',
  qte_plan: '',
  qte_reel: '',
  statut: 'Planifié' as string,
  date_planifie: '',
  instruction: '',
  comment: '',
};

export default function SerigraphieOrdersPage() {
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();
  const canAccess = hasMenuAccess('/serigraphie/orders');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<SerigraphieOrderRow | null>(null);
  const [formData, setFormData] = useState(defaultForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [searchByColumn, setSearchByColumn] = useState<Record<string, string>>({});
  const [searchInColumns, setSearchInColumns] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    Object.keys(SEARCH_COLUMNS).forEach((k) => (o[k] = true));
    return o;
  });

  const { data: rows = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['serigraphie-orders'],
    queryFn: () => serigraphieOrdersApi.getList(),
    enabled: !!user && canAccess,
  });

  const { data: dropdowns } = useQuery({
    queryKey: ['serigraphie-dropdowns'],
    queryFn: () => serigraphieOrdersApi.getDropdowns(),
    enabled: !!user && canAccess && modalOpen,
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

  const storeMutation = useMutation({
    mutationFn: (data: typeof formData & { id?: string }) =>
      serigraphieOrdersApi.store({
        id: data.id,
        OFID: data.OFID.trim(),
        prod_ref: data.prod_ref || null,
        prod_des: data.prod_des || null,
        client: data.client || null,
        commande: data.commande || null,
        qte_plan: Number(data.qte_plan) || 1,
        qte_reel: data.qte_reel ? Number(data.qte_reel) : 0,
        statut: data.statut,
        date_planifie: data.date_planifie,
        instruction: data.instruction || null,
        comment: data.comment || null,
        priority: 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serigraphie-orders'] });
      toast({ title: 'Commande enregistrée avec succès.' });
      closeModal();
    },
    onError: (err: Error & { errors?: Record<string, string[]> }) => {
      toast({
        title: 'Erreur',
        description: err.message || 'Vérifiez les champs.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => serigraphieOrdersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serigraphie-orders'] });
      toast({ title: 'Commande supprimée avec succès.' });
      setDeleteConfirmId(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
      setDeleteConfirmId(null);
    },
  });

  const importMutation = useMutation({
    mutationFn: (rows: SerigraphieImportRow[]) => serigraphieOrdersApi.import(rows),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['serigraphie-orders'] });
      toast({
        title: data.message,
        description: data.errors?.length ? data.errors.join(' ') : undefined,
      });
      setImportModalOpen(false);
      setImportFile(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Erreur import', description: err.message, variant: 'destructive' });
    },
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditingRow(null);
    setFormData(defaultForm);
  };

  const openAdd = () => {
    setEditingRow(null);
    setFormData(defaultForm);
    setModalOpen(true);
  };

  const openEdit = async (row: SerigraphieOrderRow) => {
    try {
      const one = await serigraphieOrdersApi.getOne(row.id);
      setEditingRow(one);
      setFormData({
        OFID: one.OFID ?? '',
        client: one.client ?? '',
        prod_ref: one.prod_ref ?? '',
        prod_des: one.prod_des ?? '',
        commande: one.commande ?? '',
        qte_plan: String(one.qte_plan ?? ''),
        qte_reel: String(one.qte_reel ?? ''),
        statut: one.statut ?? 'Planifié',
        date_planifie: one.date_planifie ? one.date_planifie.slice(0, 10) : '',
        instruction: one.instruction ?? '',
        comment: one.comment ?? '',
      });
      setModalOpen(true);
    } catch (e) {
      toast({ title: 'Erreur', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.OFID.trim()) {
      toast({ title: 'La référence OF est requise.', variant: 'destructive' });
      return;
    }
    if (!formData.date_planifie) {
      toast({ title: 'La date planifiée est requise.', variant: 'destructive' });
      return;
    }
    const qte = Number(formData.qte_plan);
    if (!Number.isFinite(qte) || qte < 1) {
      toast({ title: 'La quantité planifiée doit être au moins 1.', variant: 'destructive' });
      return;
    }
    storeMutation.mutate({ ...formData, id: editingRow?.id });
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try {
      return format(new Date(d), 'dd/MM/yyyy');
    } catch {
      return '—';
    }
  };

  const downloadImportTemplate = () => {
    const headers = ['Client', 'Commande', 'OFID', 'Produit (ref)', 'Date planifiée (AAAA-MM-JJ)', 'Qté plan', 'Instruction', 'Commentaire'];
    const exampleRow = ['Désignation client', 'CMD001', 'OF-123/1', 'REF001', '2025-03-15', 100, 'Instruction exemple', ''];
    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Import');
    XLSX.writeFile(wb, `Modele_import_serigraphie_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleImportSubmit = () => {
    if (!importFile) {
      toast({ title: 'Veuillez sélectionner un fichier .xlsx', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        if (!data) return;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1 }) as unknown[][];
        if (json.length < 2) {
          toast({ title: 'Le fichier ne contient pas de données.', variant: 'destructive' });
          return;
        }
        const rows: SerigraphieImportRow[] = [];
        for (let i = 1; i < json.length; i++) {
          const row = json[i] as unknown[];
          const ofid = row[2] != null ? String(row[2]).trim() : '';
          if (!ofid) continue;
          const dateVal = row[4];
          let dateStr = '';
          if (dateVal instanceof Date) {
            dateStr = format(dateVal, 'yyyy-MM-dd');
          } else if (typeof dateVal === 'number' && dateVal > 0) {
            const d = new Date((dateVal - 25569) * 86400 * 1000);
            if (!isNaN(d.getTime())) dateStr = format(d, 'yyyy-MM-dd');
          } else if (dateVal != null && dateVal !== '') {
            dateStr = String(dateVal).slice(0, 10);
          }
          rows.push({
            client: row[0] != null ? String(row[0]) : '',
            commande: row[1] != null ? String(row[1]) : '',
            OFID: ofid,
            prod_ref: row[3] != null ? String(row[3]) : '',
            date_planifie: dateStr || undefined,
            qte_plan: Number(row[5]) || 0,
            instruction: row[6] != null ? String(row[6]) : '',
            comment: row[7] != null ? String(row[7]) : '',
          });
        }
        if (rows.length === 0) {
          toast({ title: 'Aucune ligne valide (OFID requis).', variant: 'destructive' });
          return;
        }
        importMutation.mutate(rows);
      } catch (err) {
        toast({ title: 'Erreur lecture fichier', description: (err as Error).message, variant: 'destructive' });
      }
    };
    reader.readAsBinaryString(importFile);
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

  const clients = dropdowns?.clients ?? [];
  const products = dropdowns?.products ?? [];
  const commandes = dropdowns?.commandes ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Ordres de pré-fabrication</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching} aria-label="Actualiser">
              <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un OF
            </Button>
            <Button variant="secondary" onClick={() => setImportModalOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Importer
            </Button>
          </div>
        </div>

        {/* Filters card */}
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
              {filteredRows.length} ordre(s) {filteredRows.length > PAGE_SIZE ? `(affichage des ${PAGE_SIZE} premiers)` : ''}
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
                      <TableHead>Client</TableHead>
                      <TableHead>Commande</TableHead>
                      <TableHead>OFID</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead>Date Planifiée</TableHead>
                      <TableHead className="text-right">Quantité Planifiée</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="max-w-[200px]">Instruction</TableHead>
                      <TableHead className="w-[100px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
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
                          <TableCell>
                            <Badge variant="outline" className={STATUT_BADGE_CLASS[row.statut] ?? 'bg-muted'}>
                              {row.statut}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">{row.instruction ?? '—'}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(row)} aria-label="Modifier">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfirmId(row.id)}
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

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRow ? 'Modifier la commande' : 'Ajouter un OF'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ofid">Référence OF *</Label>
                <Input
                  id="ofid"
                  value={formData.OFID}
                  onChange={(e) => setFormData({ ...formData, OFID: e.target.value })}
                  placeholder="OFID"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={formData.client || 'none'} onValueChange={(v) => setFormData({ ...formData, client: v === 'none' ? '' : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une désignation client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Produit</Label>
              <Select
                value={formData.prod_ref || 'none'}
                onValueChange={(v) => {
                  if (v === 'none') {
                    setFormData({ ...formData, prod_ref: '', prod_des: '' });
                    return;
                  }
                  const p = products.find((x) => x.ref_id === v);
                  setFormData({ ...formData, prod_ref: v, prod_des: p?.product_name ?? '' });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un produit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.ref_id} value={p.ref_id}>{p.product_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Commande</Label>
              <Select value={formData.commande || 'none'} onValueChange={(v) => setFormData({ ...formData, commande: v === 'none' ? '' : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une commande" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {commandes.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="qte_plan">Quantité Planifiée *</Label>
                <Input
                  id="qte_plan"
                  type="number"
                  min={1}
                  value={formData.qte_plan}
                  onChange={(e) => setFormData({ ...formData, qte_plan: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qte_reel">Quantité Réel</Label>
                <Input
                  id="qte_reel"
                  type="number"
                  min={0}
                  value={formData.qte_reel}
                  onChange={(e) => setFormData({ ...formData, qte_reel: e.target.value })}
                  disabled
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={formData.statut} onValueChange={(v) => setFormData({ ...formData, statut: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUT_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_planifie">Date Planifiée *</Label>
                <Input
                  id="date_planifie"
                  type="date"
                  value={formData.date_planifie}
                  onChange={(e) => setFormData({ ...formData, date_planifie: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="instruction">Instruction (max 500)</Label>
              <Textarea
                id="instruction"
                value={formData.instruction}
                onChange={(e) => setFormData({ ...formData, instruction: e.target.value.slice(0, 500) })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comment">Commentaire (max 800)</Label>
              <Textarea
                id="comment"
                value={formData.comment}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value.slice(0, 800) })}
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal}>
                Annuler
              </Button>
              <Button type="submit" disabled={storeMutation.isPending}>
                {storeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingRow ? 'Mettre à jour' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importer (Excel)</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Colonnes : A=Client, B=Commande, C=OFID, D=Produit (ref), E=Date planifiée, F=Qté plan, G=Instruction, H=Commentaire. Utilisez la désignation client (Client.designation). Les marges sont appliquées côté serveur (FLACON si OFID se termine par /1, sinon ETUI).
          </p>
          <Button type="button" variant="outline" size="sm" onClick={downloadImportTemplate} className="mb-2">
            <Download className="h-4 w-4 mr-2" />
            Télécharger le modèle
          </Button>
          <div className="space-y-2">
            <Label>Fichier .xlsx</Label>
            <Input
              type="file"
              accept=".xlsx"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportModalOpen(false); setImportFile(null); }}>
              Annuler
            </Button>
            <Button onClick={handleImportSubmit} disabled={!importFile || importMutation.isPending}>
              {importMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Importer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la commande ?</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment supprimer cette commande ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
