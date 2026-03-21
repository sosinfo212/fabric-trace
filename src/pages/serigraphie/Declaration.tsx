import { useState, useMemo, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  serigraphieDeclarationApi,
  serigraphieRebutApi,
  type SerigraphieDeclarationRow,
  type SerigraphieDeclarationDetail,
  type SerigraphieRebutRow,
  type SerigraphieComponent,
  type SerigraphieDefaut,
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
import { Pencil, Eye, AlertCircle, History, Loader2, RefreshCw, Filter, Settings2, ChevronDown, Search, Trash2, Check, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const PAGE_SIZE = 100;
const STATUT_OPTIONS = ['Planifié', 'En cours', 'Réalisé', 'Suspendu', 'Cloturé'] as const;

/** Convert API date/datetime to datetime-local input value (yyyy-MM-ddTHH:mm) */
function toDateTimeLocalValue(d: string | null | undefined): string {
  if (!d) return '';
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00`;
  try {
    const date = new Date(s);
    if (Number.isNaN(date.getTime())) return '';
    return format(date, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return '';
  }
}

const STATUT_BADGE_CLASS: Record<string, string> = {
  Planifié: 'bg-blue-100 text-blue-800 border-blue-200',
  'En cours': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Réalisé: 'bg-green-100 text-green-800 border-green-200',
  Suspendu: 'bg-red-100 text-red-800 border-red-200',
  Cloturé: 'bg-cyan-100 text-cyan-800 border-cyan-200',
};

const SEARCH_COLUMNS: Record<string, string> = {
  OFID: 'OFID',
  commande: 'Commande',
  client: 'Client',
  prod_des: 'Produit',
  statut: 'Statut',
};

function encodeOFID(ofid: string): string {
  try {
    return btoa(unescape(encodeURIComponent(ofid)));
  } catch {
    return encodeURIComponent(ofid);
  }
}

export default function SerigraphieDeclarationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();
  const canAccess = hasMenuAccess('/serigraphie/declaration');

  const [searchByColumn, setSearchByColumn] = useState<Record<string, string>>({});
  const [searchInColumns, setSearchInColumns] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    Object.keys(SEARCH_COLUMNS).forEach((k) => (o[k] = true));
    return o;
  });
  const [declarationsModalOfid, setDeclarationsModalOfid] = useState<string | null>(null);
  const [rebutModalData, setRebutModalData] = useState<{ OFID: string; commande: string; product: string; client: string } | null>(null);
  const [rebutsHistoryOfid, setRebutsHistoryOfid] = useState<string | null>(null);

  const { data: rows = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['serigraphie-declaration-list'],
    queryFn: () => serigraphieDeclarationApi.getList(),
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
        if (key === 'statut') {
          const selected = val.split(',').map((s) => s.trim()).filter(Boolean);
          return selected.length > 0 && selected.includes(String(cell));
        }
        return String(cell).toLowerCase().includes(val.toLowerCase());
      })
    );
  }, [rows, searchByColumn, activeSearchKeys]);

  const displayRows = filteredRows.slice(0, PAGE_SIZE);

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try {
      return format(new Date(d), 'dd/MM/yyyy');
    } catch {
      return '—';
    }
  };

  const formatDateTime = (d: string | null) => {
    if (!d) return '—';
    try {
      return format(new Date(d), 'dd/MM/yyyy HH:mm');
    } catch {
      return '—';
    }
  };

  const goToCreate = (ofid: string) => {
    navigate(`/serigraphie/declaration/create/${encodeOFID(ofid)}`);
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
          <h1 className="text-2xl font-bold tracking-tight">Déclarations Sérigraphie</h1>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching} aria-label="Actualiser">
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Filtres</CardTitle>
                {activeSearchKeys.filter((k) => (searchByColumn[k] ?? '').trim() !== '').length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({activeSearchKeys.filter((k) => (searchByColumn[k] ?? '').trim() !== '').length} actif(s))
                  </span>
                )}
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
                    {Object.entries(SEARCH_COLUMNS).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={searchInColumns[key] === true}
                          onCheckedChange={(c) => setSearchInColumns((prev) => ({ ...prev, [key]: !!c }))}
                        />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </PopoverContent>
                </Popover>
                {activeSearchKeys.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setSearchByColumn((prev) => ({ ...prev, ...Object.fromEntries(activeSearchKeys.map((k) => [k, ''])) }))}
                  >
                    Effacer les filtres
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {activeSearchKeys.map((key) => (
                <div key={key} className="flex flex-col gap-1.5 min-w-0">
                  <Label className="text-xs text-muted-foreground truncate">{SEARCH_COLUMNS[key]}</Label>
                  {key === 'statut' ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="h-9 w-full justify-between font-normal text-xs">
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
                        {STATUT_OPTIONS.map((s) => {
                          const v = searchByColumn[key] ?? '';
                          const selected = v ? v.split(',').map((x) => x.trim()).filter(Boolean) : [];
                          const checked = selected.includes(s);
                          return (
                            <label key={s} className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(c) => {
                                  const next = c ? [...selected, s] : selected.filter((x) => x !== s);
                                  setSearchByColumn((prev) => ({ ...prev, [key]: next.join(',') }));
                                }}
                              />
                              <span className="text-sm">{s}</span>
                            </label>
                          );
                        })}
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <Input
                        placeholder={SEARCH_COLUMNS[key]}
                        value={searchByColumn[key] ?? ''}
                        onChange={(e) => setSearchByColumn((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="h-9 pl-8"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
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
                      <TableHead>OFID</TableHead>
                      <TableHead>Commande</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right">Quantité Planifiée</TableHead>
                      <TableHead className="text-right">Quantité Préparer</TableHead>
                      <TableHead className="text-right">Quantité Fabriquée</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right w-[200px]">Actions</TableHead>
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
                      displayRows.map((row: SerigraphieDeclarationRow) => (
                        <TableRow key={row.OFID + (row.planning_id ?? '')}>
                          <TableCell className="font-mono">{row.OFID}</TableCell>
                          <TableCell>{row.commande ?? '—'}</TableCell>
                          <TableCell>{row.client ?? '—'}</TableCell>
                          <TableCell>{row.prod_des ?? '—'}</TableCell>
                          <TableCell className="text-right">{row.qte_plan}</TableCell>
                          <TableCell className="text-right">{row.qte_reel}</TableCell>
                          <TableCell className="text-right">{row.qte_fab}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={STATUT_BADGE_CLASS[row.statut] ?? 'bg-muted'}>
                              {row.statut}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goToCreate(row.OFID)} title="Modifier / Déclarer">
                                <Pencil className="h-4 w-4 text-amber-600" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeclarationsModalOfid(row.OFID)} title="Détails des déclarations">
                                <Eye className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-[#1e3a8a]"
                                onClick={() => setRebutModalData({ OFID: row.OFID, commande: row.commande ?? '', product: row.prod_des ?? '', client: row.client ?? '' })}
                                title="Déclaration rebut"
                              >
                                <AlertCircle className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setRebutsHistoryOfid(row.OFID)} title="Historique rebuts">
                                <History className="h-4 w-4" />
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

      {declarationsModalOfid && (
        <DeclarationsModal
          ofid={declarationsModalOfid}
          onClose={() => setDeclarationsModalOfid(null)}
          formatDate={formatDate}
          formatDateTime={formatDateTime}
        />
      )}
      {rebutModalData && (
        <RebutModal
          ofid={rebutModalData.OFID}
          product={rebutModalData.product}
          onClose={() => setRebutModalData(null)}
          onSuccess={() => {
            setRebutModalData(null);
            queryClient.invalidateQueries({ queryKey: ['serigraphie-declaration-list'] });
          }}
        />
      )}
      {rebutsHistoryOfid != null && (
        <RebutsHistoryModal
          ofid={rebutsHistoryOfid}
          encodedOfid={encodeOFID(rebutsHistoryOfid)}
          onClose={() => setRebutsHistoryOfid(null)}
          formatDate={formatDate}
        />
      )}
    </DashboardLayout>
  );
}

function DeclarationsModal({
  ofid,
  onClose,
  formatDate,
  formatDateTime,
}: {
  ofid: string;
  onClose: () => void;
  formatDate: (d: string | null) => string;
  formatDateTime: (d: string | null) => string;
}) {
  const queryClient = useQueryClient();
  const { data: declarations = [], isLoading, refetch } = useQuery({
    queryKey: ['serigraphie-declarations', ofid],
    queryFn: () => serigraphieDeclarationApi.getByOfid(ofid),
    enabled: !!ofid,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SerigraphieDeclarationDetail> }) =>
      serigraphieDeclarationApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serigraphie-declarations', ofid] });
      queryClient.invalidateQueries({ queryKey: ['serigraphie-declaration-list'] });
      toast({ title: 'Déclaration mise à jour.' });
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => serigraphieDeclarationApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serigraphie-declarations', ofid] });
      queryClient.invalidateQueries({ queryKey: ['serigraphie-declaration-list'] });
      toast({ title: 'Déclaration supprimée.' });
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });
  const totalFab = useMemo(() => declarations.reduce((s, d) => s + (d.qte_fab || 0), 0), [declarations]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] overflow-visible p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="bg-primary text-primary-foreground -mx-6 -mt-0 px-6 py-3 rounded-t-lg">
            Détails des Déclarations - OF: {ofid}
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 overflow-visible">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-visible">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date Début</TableHead>
                    <TableHead>Date Fin</TableHead>
                    <TableHead className="text-right">Quantité Fabriquée</TableHead>
                    <TableHead>Commentaire</TableHead>
                    <TableHead className="text-right">A.Qualité</TableHead>
                    <TableHead className="text-right">A.Production</TableHead>
                    <TableHead className="w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {declarations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                        Aucune déclaration pour cet OF.
                      </TableCell>
                    </TableRow>
                  ) : (
                    declarations.map((d) => (
                      <DeclarationRow
                        key={d.id}
                        d={d}
                        formatDate={formatDate}
                        formatDateTime={formatDateTime}
                        onSave={(data) => updateMutation.mutate({ id: d.id, data })}
                        onDelete={() => {
                          if (window.confirm('Supprimer cette déclaration ?')) deleteMutation.mutate(d.id);
                        }}
                        isSaving={updateMutation.isPending}
                        isDeleting={deleteMutation.isPending}
                      />
                    ))
                  )}
                  {declarations.length > 0 && (
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right">{totalFab}</TableCell>
                      <TableCell colSpan={4} />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeclarationRow({
  d,
  formatDate,
  formatDateTime,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: {
  d: SerigraphieDeclarationDetail;
  formatDate: (x: string | null) => string;
  formatDateTime: (x: string | null) => string;
  onSave: (data: Partial<SerigraphieDeclarationDetail>) => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [date_debut, setDate_debut] = useState(() => toDateTimeLocalValue(d.date_debut));
  const [date_fin, setDate_fin] = useState(() => toDateTimeLocalValue(d.date_fin));
  const [qte_fab, setQte_fab] = useState(String(d.qte_fab ?? 0));
  const [comment, setComment] = useState(d.comment ?? '');
  const [mat_quality, setMat_quality] = useState(String(d.mat_quality ?? 0));
  const [mat_prod, setMat_prod] = useState(String(d.mat_prod ?? 0));

  useEffect(() => {
    setDate_debut(toDateTimeLocalValue(d.date_debut));
    setDate_fin(toDateTimeLocalValue(d.date_fin));
    setQte_fab(String(d.qte_fab ?? 0));
    setComment(d.comment ?? '');
    setMat_quality(String(d.mat_quality ?? 0));
    setMat_prod(String(d.mat_prod ?? 0));
  }, [d.id, d.date_debut, d.date_fin, d.qte_fab, d.comment, d.mat_quality, d.mat_prod]);

  const handleSave = () => {
    onSave({
      date_debut: date_debut || undefined,
      date_fin: date_fin || undefined,
      qte_fab: parseInt(qte_fab, 10),
      Comment: comment,
      mat_quality: parseInt(mat_quality, 10),
      mat_prod: parseInt(mat_prod, 10),
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setDate_debut(toDateTimeLocalValue(d.date_debut));
    setDate_fin(toDateTimeLocalValue(d.date_fin));
    setQte_fab(String(d.qte_fab ?? 0));
    setComment(d.comment ?? '');
    setMat_quality(String(d.mat_quality ?? 0));
    setMat_prod(String(d.mat_prod ?? 0));
    setEditing(false);
  };

  if (editing) {
    return (
      <TableRow>
        <TableCell>
          <Input type="datetime-local" value={date_debut} onChange={(e) => setDate_debut(e.target.value)} className="h-9 min-w-[180px]" />
        </TableCell>
        <TableCell>
          <Input type="datetime-local" value={date_fin} onChange={(e) => setDate_fin(e.target.value)} className="h-9 min-w-[180px]" />
        </TableCell>
        <TableCell className="text-right">
          <Input type="number" min={0} value={qte_fab} onChange={(e) => setQte_fab(e.target.value)} className="h-9 w-20 text-right" />
        </TableCell>
        <TableCell>
          <Input value={comment} onChange={(e) => setComment(e.target.value)} className="h-9" placeholder="Commentaire" />
        </TableCell>
        <TableCell className="text-right">
          <Input type="number" min={0} value={mat_quality} onChange={(e) => setMat_quality(e.target.value)} className="h-9 w-16 text-right" />
        </TableCell>
        <TableCell className="text-right">
          <Input type="number" min={0} value={mat_prod} onChange={(e) => setMat_prod(e.target.value)} className="h-9 w-16 text-right" />
        </TableCell>
        <TableCell>
          <div className="flex gap-1 flex-wrap items-center">
            <Button size="icon" variant="default" className="h-8 w-8" onClick={handleSave} disabled={isSaving} title="Enregistrer">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={handleCancel} disabled={isSaving} title="Annuler">
              <X className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="destructive" className="h-8 w-8" onClick={onDelete} disabled={isDeleting} title="Supprimer">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="py-2">{formatDateTime(d.date_debut)}</TableCell>
      <TableCell className="py-2">{formatDateTime(d.date_fin)}</TableCell>
      <TableCell className="text-right py-2">{d.qte_fab ?? 0}</TableCell>
      <TableCell className="py-2 max-w-[200px] truncate" title={d.comment ?? ''}>{d.comment || '—'}</TableCell>
      <TableCell className="text-right py-2">{d.mat_quality ?? 0}</TableCell>
      <TableCell className="text-right py-2">{d.mat_prod ?? 0}</TableCell>
      <TableCell>
        <div className="flex gap-1 flex-wrap items-center">
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setEditing(true)} title="Modifier">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="destructive" className="h-8 w-8" onClick={onDelete} disabled={isDeleting} title="Supprimer">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function RebutModal({
  ofid,
  product,
  onClose,
  onSuccess,
}: {
  ofid: string;
  product: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [date_declaration] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [quantite, setQuantite] = useState('1');
  const [composant_id, setComposant_id] = useState<string>('');
  const [defaut_id, setDefaut_id] = useState<string>('');
  const [commentaire, setCommentaire] = useState('');

  const { data: components = [] } = useQuery({
    queryKey: ['serigraphie-components', product],
    queryFn: () => serigraphieRebutApi.getComponents(product),
    enabled: !!product && !!ofid,
  });
  const { data: defauts = [] } = useQuery({
    queryKey: ['serigraphie-defauts'],
    queryFn: () => serigraphieRebutApi.getDefauts(),
    enabled: !!ofid,
  });

  const storeMutation = useMutation({
    mutationFn: () =>
      serigraphieRebutApi.store({
        OFID: ofid,
        date_declaration,
        quantite: parseInt(quantite, 10),
        composant_id: composant_id || null,
        defaut_id: defaut_id || null,
        commentaire: commentaire || null,
      }),
    onSuccess: () => {
      toast({ title: 'Rebut enregistré avec succès.' });
      onSuccess();
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseInt(quantite, 10);
    if (!Number.isFinite(q) || q < 1) {
      toast({ title: 'Quantité invalide (min 1).', variant: 'destructive' });
      return;
    }
    storeMutation.mutate();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="bg-primary text-primary-foreground -mx-6 -mt-6 px-6 py-3 rounded-t-lg">
            Déclaration Rebut - OF: {ofid}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Date de déclaration</Label>
            <Input type="date" value={date_declaration} readOnly className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Quantité *</Label>
            <Input type="number" min={1} value={quantite} onChange={(e) => setQuantite(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Composant</Label>
            <Select
              value={composant_id || '__none__'}
              onValueChange={(v) => setComposant_id(v === '__none__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un composant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {components.map((c: SerigraphieComponent) => (
                  <SelectItem key={c.id} value={c.id}>
                    [{c.component_code ?? ''}] {c.component_name ?? ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Défaut</Label>
            <Select
              value={defaut_id || '__none__'}
              onValueChange={(v) => setDefaut_id(v === '__none__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un défaut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {defauts.map((df: SerigraphieDefaut) => (
                  <SelectItem key={df.id} value={df.id}>
                    {df.label ?? ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Commentaire</Label>
            <Textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={storeMutation.isPending}>
              {storeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RebutsHistoryModal({
  ofid,
  encodedOfid,
  onClose,
  formatDate,
}: {
  ofid: string;
  encodedOfid: string;
  onClose: () => void;
  formatDate: (d: string | null) => string;
}) {
  const queryClient = useQueryClient();
  const { data: rebuts = [], isLoading } = useQuery({
    queryKey: ['serigraphie-rebuts', encodedOfid],
    queryFn: () => serigraphieRebutApi.getByOfid(encodedOfid),
    enabled: !!encodedOfid,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => serigraphieRebutApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serigraphie-rebuts', encodedOfid] });
      toast({ title: 'Rebut supprimé.' });
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });
  const totalQte = useMemo(() => rebuts.reduce((s, r) => s + r.quantite, 0), [rebuts]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="bg-muted -mx-6 -mt-6 px-6 py-3 rounded-t-lg">
            Historique des Rebuts - OF: {ofid}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date Déclaration</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead>Composant</TableHead>
                <TableHead>Défaut</TableHead>
                <TableHead>Commentaire</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rebuts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Aucun rebut enregistré pour cet OF.
                  </TableCell>
                </TableRow>
              ) : (
                rebuts.map((r: SerigraphieRebutRow) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.date_declaration)}</TableCell>
                    <TableCell className="text-right">{r.quantite}</TableCell>
                    <TableCell>{r.composant_code || r.composant_name ? `[${r.composant_code ?? ''}] ${r.composant_name ?? ''}` : 'N/A'}</TableCell>
                    <TableCell>{r.defaut_label ?? 'N/A'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{r.commentaire ?? '—'}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => window.confirm('Supprimer ce rebut ?') && deleteMutation.mutate(r.id)}
                        disabled={deleteMutation.isPending}
                      >
                        Supprimer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {rebuts.length > 0 && (
                <TableRow className="bg-amber-50 font-medium">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{totalQte}</TableCell>
                  <TableCell colSpan={4} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
