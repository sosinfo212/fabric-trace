import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { traceabilityApi, fabricationApi, type TraceabilityRow } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Pencil, FileDown } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as XLSX from 'xlsx';

const PAGE_SIZES = [25, 50, 100] as const;

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = parseISO(iso.replace(' ', 'T'));
  return isValid(d) ? format(d, 'd/M/yyyy HH:mm', { locale: fr }) : '—';
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const s = iso.replace(' ', 'T').slice(0, 16);
  return s || '';
}

export default function TraceabilityPage() {
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();
  const canAccess = hasMenuAccess('/workshop/traceability');

  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [editRow, setEditRow] = useState<TraceabilityRow | null>(null);
  const [editForm, setEditForm] = useState({
    Lot_Jus: '',
    Valid_date: '',
    effectif_Reel: '',
    date_fabrication: '',
    End_Fab_date: '',
    Pf_Qty: 0,
    Sf_Qty: 0,
    Set_qty: 0,
    Tester_qty: 0,
    Comment_chaine: '',
  });

  const { data: rows = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['workshop-traceability'],
    queryFn: () => traceabilityApi.getList(),
    enabled: !!user && canAccess,
  });

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase().trim();
    return rows.filter(
      (r) =>
        (r.OFID && r.OFID.toLowerCase().includes(q)) ||
        (r.sale_order_id && r.sale_order_id.toLowerCase().includes(q)) ||
        (r.product_name && r.product_name.toLowerCase().includes(q)) ||
        (r.client_name && r.client_name.toLowerCase().includes(q)) ||
        (r.Lot_Jus && r.Lot_Jus.toLowerCase().includes(q))
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const slice = useMemo(
    () => filteredRows.slice(currentPage * pageSize, currentPage * pageSize + pageSize),
    [filteredRows, currentPage, pageSize]
  );

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      fabricationApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-traceability'] });
      setEditRow(null);
      toast({ title: 'Enregistré', description: 'Déclaration mise à jour.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    },
  });

  const openEdit = (row: TraceabilityRow) => {
    setEditRow(row);
    setEditForm({
      Lot_Jus: row.Lot_Jus ?? '',
      Valid_date: toDatetimeLocal(row.Valid_date),
      effectif_Reel: row.effectif_Reel != null ? String(row.effectif_Reel) : '',
      date_fabrication: toDatetimeLocal(row.date_fabrication),
      End_Fab_date: toDatetimeLocal(row.End_Fab_date),
      Pf_Qty: row.Pf_Qty ?? 0,
      Sf_Qty: row.Sf_Qty ?? 0,
      Set_qty: row.Set_qty ?? 0,
      Tester_qty: row.Tester_qty ?? 0,
      Comment_chaine: row.Comment_chaine ?? '',
    });
  };

  const handleSave = () => {
    if (!editRow) return;
    const payload = {
      Lot_Jus: editForm.Lot_Jus || null,
      Valid_date: editForm.Valid_date || null,
      effectif_Reel: editForm.effectif_Reel === '' ? null : parseInt(editForm.effectif_Reel, 10),
      date_fabrication: editForm.date_fabrication || null,
      End_Fab_date: editForm.End_Fab_date || null,
      Pf_Qty: editForm.Pf_Qty,
      Sf_Qty: editForm.Sf_Qty,
      Set_qty: editForm.Set_qty,
      Tester_qty: editForm.Tester_qty,
      Comment_chaine: editForm.Comment_chaine || null,
    };
    updateMutation.mutate({ id: editRow.id, data: payload });
  };

  const exportXlsx = () => {
    const headers = [
      'ID',
      'OFID',
      'N° Commande',
      'Produit',
      'Client',
      'Lot Jus',
      'Valid Date',
      'Effectif Reel',
      'Date Fabrication',
      'PF Qty',
      'SF Qty',
      'Set Qty',
      'Tester Qty',
      'Comment Chaine',
    ];
    const data: (string | number | null)[][] = [headers];
    filteredRows.forEach((r) => {
      data.push([
        r.id,
        r.OFID ?? '',
        r.sale_order_id ?? '',
        r.product_name ?? '',
        r.client_name ?? '',
        r.Lot_Jus ?? '',
        r.Valid_date ?? '',
        r.effectif_Reel ?? '',
        r.date_fabrication ?? '',
        r.Pf_Qty ?? 0,
        r.Sf_Qty ?? 0,
        r.Set_qty ?? 0,
        r.Tester_qty ?? 0,
        r.Comment_chaine ?? '',
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fabrication');
    XLSX.writeFile(wb, `Fabrication_History_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast({ title: 'Export terminé', description: 'Fichier Excel téléchargé.' });
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
          <h1 className="text-2xl font-bold tracking-tight">Historique de la fabrication</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportXlsx} className="gap-2">
              <FileDown className="h-4 w-4" />
              Exporter (XLSX)
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              aria-label="Actualiser"
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Traçabilité fabrication</CardTitle>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <input
                type="search"
                placeholder="Rechercher (OF, commande, produit, client, lot…)"
                className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Lignes par page</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    setPageSize(Number(v));
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-semibold uppercase w-12">ID</TableHead>
                        <TableHead className="font-semibold uppercase">OFID</TableHead>
                        <TableHead className="font-semibold uppercase">N° Commande</TableHead>
                        <TableHead className="font-semibold uppercase">Produit</TableHead>
                        <TableHead className="font-semibold uppercase">Client</TableHead>
                        <TableHead className="font-semibold uppercase">Lot Jus</TableHead>
                        <TableHead className="font-semibold uppercase">Valid Date</TableHead>
                        <TableHead className="font-semibold uppercase text-right">Effectif Reel</TableHead>
                        <TableHead className="font-semibold uppercase">Date Fabrication</TableHead>
                        <TableHead className="font-semibold uppercase text-right">PF Qty</TableHead>
                        <TableHead className="font-semibold uppercase text-right">SF Qty</TableHead>
                        <TableHead className="font-semibold uppercase text-right">Set Qty</TableHead>
                        <TableHead className="font-semibold uppercase text-right">Tester Qty</TableHead>
                        <TableHead className="font-semibold uppercase max-w-[120px]">Comment Chaine</TableHead>
                        <TableHead className="font-semibold uppercase w-[100px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slice.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={15} className="text-center text-muted-foreground py-8">
                            Aucune donnée.
                          </TableCell>
                        </TableRow>
                      ) : (
                        slice.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-muted-foreground">{row.id}</TableCell>
                            <TableCell className="font-mono">{row.OFID}</TableCell>
                            <TableCell>{row.sale_order_id ?? '—'}</TableCell>
                            <TableCell>{row.product_name ?? '—'}</TableCell>
                            <TableCell>{row.client_name ?? '—'}</TableCell>
                            <TableCell>{row.Lot_Jus ?? '—'}</TableCell>
                            <TableCell>{formatDateTime(row.Valid_date)}</TableCell>
                            <TableCell className="text-right">{row.effectif_Reel ?? '—'}</TableCell>
                            <TableCell>{formatDateTime(row.date_fabrication)}</TableCell>
                            <TableCell className="text-right">{row.Pf_Qty ?? 0}</TableCell>
                            <TableCell className="text-right">{row.Sf_Qty ?? 0}</TableCell>
                            <TableCell className="text-right">{row.Set_qty ?? 0}</TableCell>
                            <TableCell className="text-right">{row.Tester_qty ?? 0}</TableCell>
                            <TableCell className="max-w-[120px] truncate" title={row.Comment_chaine ?? ''}>
                              {row.Comment_chaine ?? '—'}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => openEdit(row)} className="gap-1">
                                <Pencil className="h-4 w-4" />
                                Modifier
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      {filteredRows.length} ligne(s) — page {currentPage + 1} / {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={currentPage === 0}
                      >
                        Précédent
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={currentPage >= totalPages - 1}
                      >
                        Suivant
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Edit modal */}
        <Dialog open={!!editRow} onOpenChange={() => setEditRow(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="trace-edit-desc">
            <DialogHeader>
              <DialogTitle>Modifier la déclaration</DialogTitle>
              <DialogDescription id="trace-edit-desc">
                Modifier les champs de la déclaration de fabrication. OFID en lecture seule.
              </DialogDescription>
            </DialogHeader>
            {editRow && (
              <div className="grid gap-4 py-4">
                <input type="hidden" value={editRow.id} readOnly />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>OFID</Label>
                    <Input value={editRow.OFID} readOnly className="bg-muted" />
                  </div>
                  <div>
                    <Label>Lot Jus</Label>
                    <Input
                      value={editForm.Lot_Jus}
                      onChange={(e) => setEditForm((f) => ({ ...f, Lot_Jus: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valid Date</Label>
                    <Input
                      type="datetime-local"
                      value={editForm.Valid_date}
                      onChange={(e) => setEditForm((f) => ({ ...f, Valid_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Effectif Reel</Label>
                    <Input
                      type="number"
                      value={editForm.effectif_Reel}
                      onChange={(e) => setEditForm((f) => ({ ...f, effectif_Reel: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label>Date Fabrication</Label>
                  <Input
                    type="datetime-local"
                    value={editForm.date_fabrication}
                    onChange={(e) => setEditForm((f) => ({ ...f, date_fabrication: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>End Fab Date</Label>
                  <Input
                    type="datetime-local"
                    value={editForm.End_Fab_date}
                    onChange={(e) => setEditForm((f) => ({ ...f, End_Fab_date: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label>PF Qty</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editForm.Pf_Qty}
                      onChange={(e) => setEditForm((f) => ({ ...f, Pf_Qty: parseInt(e.target.value, 10) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label>SF Qty</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editForm.Sf_Qty}
                      onChange={(e) => setEditForm((f) => ({ ...f, Sf_Qty: parseInt(e.target.value, 10) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label>Set Qty</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editForm.Set_qty}
                      onChange={(e) => setEditForm((f) => ({ ...f, Set_qty: parseInt(e.target.value, 10) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label>Tester Qty</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editForm.Tester_qty}
                      onChange={(e) => setEditForm((f) => ({ ...f, Tester_qty: parseInt(e.target.value, 10) || 0 }))}
                    />
                  </div>
                </div>
                <div>
                  <Label>Comment Chaine</Label>
                  <Textarea
                    value={editForm.Comment_chaine}
                    onChange={(e) => setEditForm((f) => ({ ...f, Comment_chaine: e.target.value }))}
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditRow(null)}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
