import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { laquageApi, type LaquageDeclarationRow } from '@/lib/api';
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
import { Search, History, Plus, Pencil, Trash2, Inbox, Loader2, Filter, RefreshCw, Settings2, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { StatusBadge } from './components/StatusBadge';
import { cn } from '@/lib/utils';
import type { LaquageDeclarationHistoryItem } from '@/lib/api';

const STATUS_OPTIONS = ['Planifié', 'En cours', 'Réalisé'] as const;
const PAGE_SIZE = 100;

const SEARCH_COLUMNS: Record<string, string> = {
  client: 'Client',
  commande: 'Commande',
  OFID: 'OFID',
  designation: 'Désignation',
  status: 'Statut',
};

function formatDate(d: string | null) {
  if (!d) return '—';
  const date = new Date(d);
  return isNaN(date.getTime()) ? '—' : format(date, 'dd MMM yyyy', { locale: fr });
}

function parseTimeToMinutes(t: string | null): number {
  if (!t || !/^\d{2}:\d{2}$/.test(t)) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h00`;
}

export default function LaquageDeclarationsPage() {
  const queryClient = useQueryClient();
  const { loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();
  const canAccess = hasMenuAccess('/lacquering/declaration');

  const [searchByColumn, setSearchByColumn] = useState<Record<string, string>>({});
  const [searchInColumns, setSearchInColumns] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    Object.keys(SEARCH_COLUMNS).forEach((k) => (o[k] = true));
    return o;
  });
  const [historyLaquageId, setHistoryLaquageId] = useState<number | null>(null);
  const [historyRows, setHistoryRows] = useState<LaquageDeclarationHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [declareRow, setDeclareRow] = useState<LaquageDeclarationRow | null>(null);
  const [declareOpen, setDeclareOpen] = useState(false);
  const [editDeclItem, setEditDeclItem] = useState<LaquageDeclarationHistoryItem | null>(null);
  const [editDeclOpen, setEditDeclOpen] = useState(false);
  const [deleteDeclId, setDeleteDeclId] = useState<number | null>(null);

  const { data: rows = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['laquage-declarations'],
    queryFn: () => laquageApi.getDeclarations(),
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

  const openHistory = (laquageId: number) => {
    setHistoryLaquageId(laquageId);
    setHistoryLoading(true);
    laquageApi
      .getDeclarationHistory(laquageId)
      .then(setHistoryRows)
      .finally(() => setHistoryLoading(false));
  };

  const deleteDeclMutation = useMutation({
    mutationFn: (id: number) => laquageApi.deleteDeclaration(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laquage-declarations'] });
      setDeleteDeclId(null);
      setHistoryLaquageId(null);
      toast({ title: 'Déclaration supprimée.' });
    },
    onError: () => {
      toast({ title: 'Erreur', variant: 'destructive' });
    },
  });

  const totalFabrique = useMemo(
    () => historyRows.reduce((s, d) => s + (d.quantite_fabriquee ?? 0), 0),
    [historyRows]
  );

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
            <h1 className="text-2xl font-bold tracking-tight">Laquage - Déclarations</h1>
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
                ) : displayRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Inbox className="h-12 w-12 mb-2" />
                    <p>
                      {activeSearchKeys.some((k) => (searchByColumn[k] ?? '').trim() !== '')
                        ? 'Aucune déclaration pour les filtres sélectionnés.'
                        : 'Aucune déclaration enregistrée.'}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Commande</TableHead>
                        <TableHead>OFID</TableHead>
                        <TableHead>Désignation</TableHead>
                        <TableHead>Qté planifiée</TableHead>
                        <TableHead>Qté fabriquée</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayRows.map((row) => (
                        <TableRow key={row.laquage_id} className="h-[35px]">
                          <TableCell className="py-1 px-2 text-[13px] align-middle">{row.client}</TableCell>
                          <TableCell className="py-1 px-2 text-[13px] align-middle">{row.commande}</TableCell>
                          <TableCell className="py-1 px-2 text-[13px] align-middle">{row.OFID}</TableCell>
                          <TableCell className="py-1 px-2 text-[13px] align-middle">{row.designation}</TableCell>
                          <TableCell className="py-1 px-2 text-[13px] align-middle">{row.quantite_planifie}</TableCell>
                          <TableCell className="py-1 px-2 text-[13px] align-middle">{row.total_fabriquee}</TableCell>
                          <TableCell className="py-1 px-2 text-[13px] align-middle">
                            <StatusBadge status={row.status} />
                          </TableCell>
                          <TableCell className="py-1 px-2 text-[13px] align-middle">
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 text-blue-600"
                                onClick={() => openHistory(row.laquage_id)}
                              >
                                <History className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 text-green-600"
                                onClick={() => {
                                  setDeclareRow(row);
                                  setDeclareOpen(true);
                                }}
                              >
                                <Plus className="h-4 w-4" />
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

        {/* History modal */}
        <Dialog open={historyLaquageId != null} onOpenChange={(open) => !open && setHistoryLaquageId(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Historique des Déclarations</DialogTitle>
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
                      <TableHead className="text-[10px] font-bold uppercase">Date déclaration</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Heure début</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Heure fin</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Durée</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Quantité fabriquée</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyRows.map((d) => {
                      const startM = parseTimeToMinutes(d.heure_debut);
                      const endM = parseTimeToMinutes(d.heure_fin);
                      const dur = endM - startM;
                      return (
                        <TableRow key={d.id}>
                          <TableCell className="text-[13px]">{formatDate(d.day)}</TableCell>
                          <TableCell className="text-[13px]">{d.heure_debut ?? '—'}</TableCell>
                          <TableCell className="text-[13px]">{d.heure_fin ?? '—'}</TableCell>
                          <TableCell className="text-[13px]">{formatDuration(dur)}</TableCell>
                          <TableCell className="text-[13px] font-bold">{d.quantite_fabriquee}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 text-blue-600"
                                onClick={() => {
                                  setHistoryLaquageId(null);
                                  setTimeout(() => {
                                    setEditDeclItem(d);
                                    setEditDeclOpen(true);
                                  }, 300);
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
                      );
                    })}
                  </TableBody>
                </Table>
                <p className="text-blue-600 font-bold pt-2">Total fabriqué : {totalFabrique}</p>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Declare modal + Edit declaration modal: placeholder - open declare modal with form */}
        {declareRow && (
          <DeclareModal
            open={declareOpen}
            onOpenChange={setDeclareOpen}
            row={declareRow}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['laquage-declarations'] });
              setDeclareOpen(false);
              setDeclareRow(null);
            }}
          />
        )}

        {editDeclItem != null && (
          <EditDeclarationModal
            open={editDeclOpen}
            onOpenChange={(o) => {
              setEditDeclOpen(o);
              if (!o) setEditDeclItem(null);
            }}
            declaration={editDeclItem}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['laquage-declarations'] });
              setEditDeclOpen(false);
              setEditDeclItem(null);
              if (historyLaquageId != null) {
                laquageApi.getDeclarationHistory(historyLaquageId).then(setHistoryRows);
              }
            }}
          />
        )}

        <AlertDialog open={deleteDeclId != null} onOpenChange={(open) => !open && setDeleteDeclId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
              <AlertDialogDescription>
                Voulez-vous vraiment supprimer cette déclaration ?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive"
                onClick={() => {
                  if (deleteDeclId != null) {
                    deleteDeclMutation.mutate(deleteDeclId);
                  }
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

// New declaration modal
function DeclareModal({
  open,
  onOpenChange,
  row,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: LaquageDeclarationRow;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [quantiteFabriquee, setQuantiteFabriquee] = useState('');
  const [heureDebut, setHeureDebut] = useState('');
  const [heureFin, setHeureFin] = useState('');
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [commentaire, setCommentaire] = useState('');
  const [error, setError] = useState('');

  const today = new Date().toISOString().slice(0, 10);
  const startM = heureDebut ? parseTimeToMinutes(heureDebut) : 0;
  const endM = heureFin ? parseTimeToMinutes(heureFin) : 0;
  const durationM = endM - startM;
  const durationValid = durationM > 0;
  const inRange = (m: number) => m >= 480 && m <= 1050; // 08:00 - 17:30
  const heureDebutValid = !heureDebut || inRange(startM);
  const heureFinValid = !heureFin || inRange(endM);

  const setDefaultTimes = () => {
    const now = new Date();
    const totalM = now.getHours() * 60 + now.getMinutes();
    if (totalM >= 480 && totalM <= 1050) {
      const endM = Math.min(totalM + 60, 1050);
      setHeureDebut(
        `${String(Math.floor(totalM / 60)).padStart(2, '0')}:${String(totalM % 60).padStart(2, '0')}`
      );
      setHeureFin(
        `${String(Math.floor(endM / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
      );
    } else {
      setHeureDebut('08:00');
      setHeureFin('09:00');
    }
  };

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setQuantiteFabriquee('');
      setCommentaire('');
      setDay(today);
      setError('');
      setDefaultTimes();
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const qte = parseInt(quantiteFabriquee, 10);
    if (!Number.isFinite(qte) || qte < 1) {
      setError('La quantité doit être supérieure à 0.');
      return;
    }
    if (!heureDebut || !heureFin) {
      setError('Heure début et heure fin requises.');
      return;
    }
    if (!heureDebutValid || !heureFinValid) {
      setError('Les heures doivent être entre 08h00 et 17h30.');
      return;
    }
    if (!durationValid) {
      setError('L\'heure de fin doit être supérieure à l\'heure de début.');
      return;
    }
    setLoading(true);
    try {
      await laquageApi.createDeclaration({
        laquageId: row.laquage_id,
        quantiteFabriquee: qte,
        day,
        heureDebut,
        heureFin,
        commentaire: commentaire.trim() || undefined,
      });
      onSuccess();
      handleOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la création.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle déclaration</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md bg-muted p-3 space-y-2 text-sm">
            <p><span className="font-medium">Client :</span> {row.client}</p>
            <p><span className="font-medium">Commande :</span> {row.commande}</p>
            <p><span className="font-medium">OFID :</span> {row.OFID}</p>
            <p><span className="font-medium">Quantité planifiée :</span> {row.quantite_planifie}</p>
            <p><span className="font-medium">Désignation :</span> {row.designation}</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Quantité fabriquée <span className="text-destructive">*</span></label>
            <Input
              type="number"
              min={1}
              required
              value={quantiteFabriquee}
              onChange={(e) => setQuantiteFabriquee(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Heure début <span className="text-destructive">*</span></label>
              <Input
                type="time"
                required
                value={heureDebut}
                onChange={(e) => setHeureDebut(e.target.value)}
                className={cn('h-9', !heureDebutValid && 'border-red-500')}
              />
              {heureDebut && !heureDebutValid && (
                <p className="text-xs text-amber-600">⚠️ Les heures doivent être entre 08h00 et 17h30</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Heure fin <span className="text-destructive">*</span></label>
              <Input
                type="time"
                required
                value={heureFin}
                onChange={(e) => setHeureFin(e.target.value)}
                className={cn('h-9', !heureFinValid && 'border-red-500')}
              />
              {heureFin && !heureFinValid && (
                <p className="text-xs text-amber-600">⚠️ Les heures doivent être entre 08h00 et 17h30</p>
              )}
            </div>
          </div>
          <p className={cn('text-sm', durationValid ? 'text-blue-600' : 'text-red-600')}>
            {durationValid
              ? `Durée : ${formatDuration(durationM)}`
              : 'Heure de fin doit être supérieure à heure de début'}
          </p>
          <div className="space-y-1">
            <label className="text-sm font-medium">Date de déclaration <span className="text-destructive">*</span></label>
            <Input type="date" required max={today} value={day} onChange={(e) => setDay(e.target.value)} className="h-9" />
            <p className="text-xs text-muted-foreground">Vous pouvez sélectionner une date antérieure</p>
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
            <p className={cn(
              'text-xs',
              commentaire.length > 450 ? 'text-yellow-600' : '',
              commentaire.length > 500 ? 'text-red-600' : ''
            )}>
              {commentaire.length}/500 caractères
            </p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Edit declaration modal
function EditDeclarationModal({
  open,
  onOpenChange,
  declaration,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  declaration: LaquageDeclarationHistoryItem;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [quantiteFabriquee, setQuantiteFabriquee] = useState('');
  const [heureDebut, setHeureDebut] = useState('');
  const [heureFin, setHeureFin] = useState('');
  const [day, setDay] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [error, setError] = useState('');

  const inRange = (m: number) => m >= 480 && m <= 1050;
  const startM = heureDebut ? parseTimeToMinutes(heureDebut) : 0;
  const endM = heureFin ? parseTimeToMinutes(heureFin) : 0;
  const durationValid = endM > startM;
  const heureDebutValid = !heureDebut || inRange(startM);
  const heureFinValid = !heureFin || inRange(endM);

  useEffect(() => {
    if (open && declaration) {
      setQuantiteFabriquee(String(declaration.quantite_fabriquee));
      setHeureDebut(declaration.heure_debut ?? '08:00');
      setHeureFin(declaration.heure_fin ?? '09:00');
      setDay(declaration.day ? declaration.day.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setCommentaire(declaration.commentaire ?? '');
      setError('');
    }
  }, [open, declaration]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const qte = parseInt(quantiteFabriquee, 10);
    if (!Number.isFinite(qte) || qte < 1) {
      setError('La quantité doit être supérieure à 0.');
      return;
    }
    if (!heureDebut || !heureFin || !durationValid || !heureDebutValid || !heureFinValid) {
      setError('Vérifiez les heures (08h00-17h30, fin > début).');
      return;
    }
    setLoading(true);
    try {
      await laquageApi.updateDeclaration(declaration.id, {
        quantiteFabriquee: qte,
        day,
        heureDebut,
        heureFin,
        commentaire: commentaire.trim() || undefined,
      });
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message || 'Erreur.');
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier la déclaration</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Quantité fabriquée <span className="text-destructive">*</span></label>
            <Input
              type="number"
              min={1}
              required
              value={quantiteFabriquee}
              onChange={(e) => setQuantiteFabriquee(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Heure début <span className="text-destructive">*</span></label>
              <Input
                type="time"
                required
                value={heureDebut}
                onChange={(e) => setHeureDebut(e.target.value)}
                className={cn('h-9', !heureDebutValid && 'border-red-500')}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Heure fin <span className="text-destructive">*</span></label>
              <Input
                type="time"
                required
                value={heureFin}
                onChange={(e) => setHeureFin(e.target.value)}
                className={cn('h-9', !heureFinValid && 'border-red-500')}
              />
            </div>
          </div>
          <p className={cn('text-sm', durationValid ? 'text-blue-600' : 'text-red-600')}>
            {durationValid ? `Durée : ${formatDuration(endM - startM)}` : 'Heure fin > heure début'}
          </p>
          <div className="space-y-1">
            <label className="text-sm font-medium">Date de déclaration <span className="text-destructive">*</span></label>
            <Input type="date" required max={today} value={day} onChange={(e) => setDay(e.target.value)} className="h-9" />
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
            <p className="text-xs text-muted-foreground">{commentaire.length}/500 caractères</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
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
