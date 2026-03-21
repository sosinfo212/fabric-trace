import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { laquageApi, type LaquageRebutOrderRow, type LaquageRebutHistoryItem } from '@/lib/api';
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
  DialogFooter,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Search, History, AlertTriangle, Pencil, Trash2, Inbox, Loader2, Filter, RefreshCw, Settings2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { REBUT_COMPOSANTS, REBUT_DEFAUTS, REBUT_DEFAUT_LABELS } from './REBUT_COMPOSANTS';
import { cn } from '@/lib/utils';

function formatDateTime(d: string | null) {
  if (!d) return '—';
  const date = new Date(d);
  return isNaN(date.getTime()) ? '—' : format(date, 'dd/MM/yyyy HH:mm', { locale: fr });
}

const PAGE_SIZE = 100;
const SEARCH_COLUMNS: Record<string, string> = {
  client: 'Client',
  commande: 'Commande',
  OFID: 'OFID',
};

const DEFAUT_BADGE_CLASS: Record<string, string> = {
  Poudre: 'bg-yellow-100 text-yellow-800',
  Peinture: 'bg-slate-100 text-slate-800',
  Temperature: 'bg-orange-100 text-orange-800',
  Casse: 'bg-pink-100 text-pink-800',
};

export default function LaquageRebutsPage() {
  const queryClient = useQueryClient();
  const { loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();
  const canAccess = hasMenuAccess('/lacquering/waste');

  const [searchByColumn, setSearchByColumn] = useState<Record<string, string>>({});
  const [searchInColumns, setSearchInColumns] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    Object.keys(SEARCH_COLUMNS).forEach((k) => (o[k] = true));
    return o;
  });
  const [rebutOrder, setRebutOrder] = useState<LaquageRebutOrderRow | null>(null);
  const [rebutModalOpen, setRebutModalOpen] = useState(false);
  const [historyOfid, setHistoryOfid] = useState<string | null>(null);
  const [historyRows, setHistoryRows] = useState<LaquageRebutHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editRebut, setEditRebut] = useState<LaquageRebutHistoryItem | null>(null);
  const [editRebutOpen, setEditRebutOpen] = useState(false);
  const [deleteRebutId, setDeleteRebutId] = useState<number | null>(null);

  const { data: ordres = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['laquage-rebuts'],
    queryFn: () => laquageApi.getRebuts(),
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

  const openHistory = (ofid: string) => {
    setHistoryOfid(ofid);
    setHistoryLoading(true);
    laquageApi
      .getRebutHistory(ofid)
      .then(setHistoryRows)
      .finally(() => setHistoryLoading(false));
  };

  const deleteRebutMutation = useMutation({
    mutationFn: (id: number) => laquageApi.deleteRebut(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laquage-rebuts'] });
      setDeleteRebutId(null);
      setHistoryOfid(null);
      toast({ title: 'Rebut supprimé.' });
    },
    onError: () => toast({ title: 'Erreur', variant: 'destructive' }),
  });

  const totalRebuts = useMemo(() => historyRows.reduce((s, r) => s + r.quantite, 0), [historyRows]);

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
      <TooltipProvider>
        <div className="space-y-6 p-4 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Link to="/lacquering/orders" className="hover:text-foreground">Laquage</Link>
                <span>/</span>
                <span className="text-foreground">Rebuts</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Laquage - Rebuts</h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              aria-label="Actualiser"
            >
              <RefreshCw className={cn('h-4 w-4', isRefetching && 'animate-spin')} />
            </Button>
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                <CardTitle className="text-base">Liste des ordres - Déclaration Rebuts</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {filteredOrdres.length} ordre(s){' '}
                  {filteredOrdres.length > PAGE_SIZE ? `(affichage des ${PAGE_SIZE} premiers)` : ''}
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
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                {isLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Chargement...</div>
                ) : displayOrdres.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Inbox className="h-12 w-12 mb-2" />
                    <p>
                      {activeSearchKeys.some((k) => (searchByColumn[k] ?? '').trim() !== '')
                        ? 'Aucun ordre pour les filtres sélectionnés.'
                        : 'Aucun ordre de fabrication trouvé.'}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Commande</TableHead>
                        <TableHead>OFID</TableHead>
                        <TableHead>Rebuts</TableHead>
                        <TableHead className="w-[140px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayOrdres.map((row) => (
                        <TableRow key={row.id} className="h-[35px]">
                          <TableCell className="py-1 px-2 text-[13px] font-bold align-middle">{row.client}</TableCell>
                          <TableCell className="py-1 px-2 text-[13px] align-middle">{row.commande}</TableCell>
                          <TableCell className="py-1 px-2 text-[13px] align-middle">
                            <span className="inline-flex items-center rounded bg-blue-100 text-blue-800 px-2 py-0.5 text-[11px]">
                              {row.OFID}
                            </span>
                          </TableCell>
                          <TableCell className="py-1 px-2 text-[13px] align-middle">
                            <span className="font-bold text-red-600">
                              {row.totalRebut > 0 ? `${row.totalRebut} rebuts` : '—'}
                            </span>
                          </TableCell>
                          <TableCell className="py-1 px-2 text-[13px] align-middle">
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 text-red-600 border-red-300 hover:bg-red-50"
                                onClick={() => {
                                  setRebutOrder(row);
                                  setRebutModalOpen(true);
                                }}
                              >
                                <AlertTriangle className="h-4 w-4 mr-1" />
                                Déclarer rebut
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 text-blue-600"
                                onClick={() => openHistory(row.OFID)}
                              >
                                <History className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Rebut declaration modal */}
        {rebutOrder && (
          <RebutModal
            open={rebutModalOpen}
            onOpenChange={(o) => {
              setRebutModalOpen(o);
              if (!o) setRebutOrder(null);
            }}
            order={rebutOrder}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['laquage-rebuts'] });
              setRebutModalOpen(false);
              setRebutOrder(null);
            }}
          />
        )}

        {/* Rebut history modal */}
        <Dialog open={historyOfid != null} onOpenChange={(o) => !o && setHistoryOfid(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Historique des Rebuts - {historyOfid ?? ''}</DialogTitle>
            </DialogHeader>
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#b4b0b0]">
                      <TableHead className="text-[10px] font-bold uppercase">Date Création</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Quantité</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Composant</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Défaut</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Commentaire</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-[13px]">{formatDateTime(r.created_at)}</TableCell>
                        <TableCell className="text-[13px] font-bold text-red-600">{r.quantite}</TableCell>
                        <TableCell className="text-[13px]">
                          <span className="inline-flex rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[11px]">
                            {r.composant}
                          </span>
                        </TableCell>
                        <TableCell className="text-[13px]">
                          <span className={cn('inline-flex rounded px-1.5 py-0.5 text-[11px]', DEFAUT_BADGE_CLASS[r.defaut] ?? 'bg-gray-100')}>
                            {REBUT_DEFAUT_LABELS[r.defaut] ?? r.defaut}
                          </span>
                        </TableCell>
                        <TableCell className="text-[13px] max-w-[180px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate">{r.commentaire || '—'}</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">{r.commentaire || '—'}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 text-blue-600"
                              onClick={() => {
                                setHistoryOfid(null);
                                setTimeout(() => {
                                  setEditRebut(r);
                                  setEditRebutOpen(true);
                                }, 300);
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
                <p className="text-red-600 font-bold pt-2">Total rebuts : {totalRebuts}</p>
              </>
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
              queryClient.invalidateQueries({ queryKey: ['laquage-rebuts'] });
              setEditRebutOpen(false);
              setEditRebut(null);
              if (historyOfid != null) laquageApi.getRebutHistory(historyOfid).then(setHistoryRows);
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
      </TooltipProvider>
    </DashboardLayout>
  );
}

function RebutModal({
  open,
  onOpenChange,
  order,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  order: LaquageRebutOrderRow;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [quantite, setQuantite] = useState('');
  const [composant, setComposant] = useState('');
  const [defaut, setDefaut] = useState<string>('Poudre');
  const [commentaire, setCommentaire] = useState('');
  const createdLabel = formatDateTime(new Date().toISOString());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qte = parseInt(quantite, 10);
    if (!Number.isFinite(qte) || qte < 1) return;
    if (!composant.trim()) return;
    setLoading(true);
    try {
      await laquageApi.createRebut({
        ofid: order.OFID,
        quantite: qte,
        composant: composant.trim(),
        defaut: defaut as 'Poudre' | 'Peinture' | 'Temperature' | 'Casse',
        commentaire: commentaire.trim() || undefined,
      });
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Erreur', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Déclaration du rebut</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md bg-muted p-3 space-y-1 text-sm">
            <p><span className="font-medium">Client :</span> {order.client}</p>
            <p><span className="font-medium">Commande :</span> {order.commande}</p>
            <p><span className="font-medium">OFID :</span> {order.OFID}</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Date de création</label>
            <Input readOnly value={createdLabel} className="h-9 bg-muted" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Quantité rebut <span className="text-destructive">*</span></label>
            <Input
              type="number"
              min={1}
              required
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Composant <span className="text-destructive">*</span></label>
            <select
              required
              value={composant}
              onChange={(e) => setComposant(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Sélectionner...</option>
              {REBUT_COMPOSANTS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Défaut <span className="text-destructive">*</span></label>
            <select
              required
              value={defaut}
              onChange={(e) => setDefaut(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {REBUT_DEFAUTS.map((d) => (
                <option key={d} value={d}>{REBUT_DEFAUT_LABELS[d]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Commentaire</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={3}
              maxLength={500}
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{commentaire.length}/500</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditRebutModal({
  open,
  onOpenChange,
  item,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item: LaquageRebutHistoryItem;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [quantite, setQuantite] = useState('');
  const [composant, setComposant] = useState('');
  const [defaut, setDefaut] = useState('');
  const [commentaire, setCommentaire] = useState('');

  useEffect(() => {
    if (open && item) {
      setQuantite(String(item.quantite));
      setComposant(item.composant);
      setDefaut(item.defaut);
      setCommentaire(item.commentaire ?? '');
    }
  }, [open, item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qte = parseInt(quantite, 10);
    if (!Number.isFinite(qte) || qte < 1 || !composant.trim()) return;
    setLoading(true);
    try {
      await laquageApi.updateRebut(item.id, {
        quantite: qte,
        composant: composant.trim(),
        defaut: defaut as 'Poudre' | 'Peinture' | 'Temperature' | 'Casse',
        commentaire: commentaire.trim() || undefined,
      });
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le rebut</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">OFID</label>
            <Input readOnly value={item.OFID} className="h-9 bg-muted" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Date de création</label>
            <Input readOnly value={formatDateTime(item.created_at)} className="h-9 bg-muted" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Quantité rebut <span className="text-destructive">*</span></label>
            <Input
              type="number"
              min={1}
              required
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Composant <span className="text-destructive">*</span></label>
            <select
              required
              value={composant}
              onChange={(e) => setComposant(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {REBUT_COMPOSANTS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Défaut <span className="text-destructive">*</span></label>
            <select
              required
              value={defaut}
              onChange={(e) => setDefaut(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {REBUT_DEFAUTS.map((d) => (
                <option key={d} value={d}>{REBUT_DEFAUT_LABELS[d]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Commentaire</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={3}
              maxLength={500}
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{commentaire.length}/500</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
