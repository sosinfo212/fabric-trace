import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { transfertApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from './StatusBadge';
import { MouvementBadge } from './MouvementBadge';
import { Pencil, Trash2, Lock } from 'lucide-react';
import type { TransfertFabrication } from '@/types/transfert';
import { toast } from 'sonner';
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
import { TableColumnPicker } from '@/components/ui/table-column-picker';
import {
  useTableColumnVisibility,
  countVisibleTableColumns,
  type TableColumnDef,
} from '@/hooks/use-table-column-visibility';

const TRANSFERT_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'num_pal', label: 'N° Palette' },
  { id: 'num_comm', label: 'N° Commande' },
  { id: 'client', label: 'Client' },
  { id: 'product', label: 'Produit' },
  { id: 'qty_box', label: 'Qty Box' },
  { id: 'unit_perbox', label: 'Unit/Box' },
  { id: 'qty_unit', label: 'Qty Unit' },
  { id: 'total_qty', label: 'Total Qty' },
  { id: 'mouvement', label: 'Mouvement' },
  { id: 'statut', label: 'Statut' },
  { id: 'actions', label: 'Actions', required: true },
];

const PAGE_SIZES = [10, 25, 50, 100];
const POLL_INTERVAL_MS = 3000;

function canShowDelete(transfert: TransfertFabrication, currentUserName: string): boolean {
  if (transfert.statut === 'Récéptionné') return false;
  return transfert.createdBy === currentUserName;
}

function canShowEdit(transfert: TransfertFabrication): boolean {
  return true;
}

function showLockOnly(transfert: TransfertFabrication): boolean {
  return transfert.statut === 'Récéptionné';
}

interface TransfertTableProps {
  transferts: TransfertFabrication[];
  statusMap: Record<number, string>;
  onStatusChange: (id: number, statut: string) => void;
  refetch: () => void;
}

export function TransfertTable({ transferts, statusMap, onStatusChange, refetch }: TransfertTableProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserName = user?.full_name || user?.email || '';
  const [pageSize, setPageSize] = useState(100);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { isVisible, toggle, reset, optionalColumns, visibility } = useTableColumnVisibility(
    'transfer-transferts',
    TRANSFERT_TABLE_COLUMNS
  );
  const transfertColSpan = countVisibleTableColumns(TRANSFERT_TABLE_COLUMNS, visibility, 0);

  const { data: statusData } = useQuery({
    queryKey: ['transfert-status-check'],
    queryFn: () => transfertApi.statusCheck(),
    refetchInterval: POLL_INTERVAL_MS,
  });

  useEffect(() => {
    if (!statusData?.data) return;
    for (const { id, statut } of statusData.data) {
      const prev = statusMap[id] ?? transferts.find((t) => t.id === id)?.statut;
      if (prev !== undefined && prev !== statut && statut === 'Récéptionné') {
        toast.info(`Le transfert #${id} a été mis à jour avec le statut Récéptionné`);
      }
      onStatusChange(id, statut);
    }
  }, [statusData, onStatusChange, transferts, statusMap]);

  const paginated = useMemo(() => {
    const size = pageSize === -1 ? transferts.length : Math.min(pageSize, transferts.length);
    return transferts.slice(0, size);
  }, [transferts, pageSize]);

  const displayList = useMemo(() => {
    return paginated.map((t) => ({ ...t, statut: statusMap[t.id] ?? t.statut }));
  }, [paginated, statusMap]);

  const handleDelete = async () => {
    if (deleteId == null) return;
    setDeleting(true);
    try {
      await transfertApi.delete(deleteId);
      toast.success('Transfert supprimé');
      refetch();
      setDeleteId(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur suppression');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Afficher</span>
          <Select
            value={pageSize === -1 ? 'all' : String(pageSize)}
            onValueChange={(v) => setPageSize(v === 'all' ? -1 : parseInt(v, 10))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
              <SelectItem value="all">Tous</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">entrées</span>
        </div>
        <TableColumnPicker
          optionalColumns={optionalColumns}
          visibility={visibility}
          onToggle={toggle}
          onReset={reset}
        />
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {isVisible('num_pal') && (
                <TableHead className="w-[90px] text-center">N° Palette</TableHead>
              )}
              {isVisible('num_comm') && <TableHead>N° Commande</TableHead>}
              {isVisible('client') && <TableHead>Client</TableHead>}
              {isVisible('product') && <TableHead>Produit</TableHead>}
              {isVisible('qty_box') && (
                <TableHead className="w-[70px] text-center">Qty Box</TableHead>
              )}
              {isVisible('unit_perbox') && (
                <TableHead className="w-[80px] text-center">Unit/Box</TableHead>
              )}
              {isVisible('qty_unit') && (
                <TableHead className="w-[70px] text-center">Qty Unit</TableHead>
              )}
              {isVisible('total_qty') && (
                <TableHead className="w-[90px] text-center">Total Qty</TableHead>
              )}
              {isVisible('mouvement') && <TableHead className="w-[80px]">Mouvement</TableHead>}
              {isVisible('statut') && <TableHead className="w-[110px]">Statut</TableHead>}
              {isVisible('actions') && <TableHead className="w-[120px] text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayList.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={Math.max(transfertColSpan, 1)}
                  className="py-8 text-center text-muted-foreground"
                >
                  Aucun transfert à afficher
                </TableCell>
              </TableRow>
            ) : (
              displayList.map((t) => (
                <TableRow key={t.id}>
                  {isVisible('num_pal') && (
                    <TableCell className="text-center font-medium">{t.numPal}</TableCell>
                  )}
                  {isVisible('num_comm') && <TableCell className="font-medium">{t.numComm}</TableCell>}
                  {isVisible('client') && <TableCell>{t.client}</TableCell>}
                  {isVisible('product') && <TableCell>{t.product}</TableCell>}
                  {isVisible('qty_box') && <TableCell className="text-center">{t.qtyBox}</TableCell>}
                  {isVisible('unit_perbox') && (
                    <TableCell className="text-center">{t.unitPerbox ?? '-'}</TableCell>
                  )}
                  {isVisible('qty_unit') && <TableCell className="text-center">{t.qtyUnit}</TableCell>}
                  {isVisible('total_qty') && (
                    <TableCell className="text-center font-medium text-primary">
                      {t.totalQty ?? '-'}
                    </TableCell>
                  )}
                  {isVisible('mouvement') && (
                    <TableCell>
                      <MouvementBadge mouvement={t.mouvement} />
                    </TableCell>
                  )}
                  {isVisible('statut') && (
                    <TableCell>
                      <StatusBadge statut={t.statut} />
                    </TableCell>
                  )}
                  {isVisible('actions') && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {showLockOnly(t) ? (
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Transfert réceptionné">
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        ) : (
                          <>
                            {canShowEdit(t) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => navigate(`/transfer/movements/${t.id}/edit`)}
                                title="Modifier"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canShowDelete(t, currentUserName) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteId(t.id)}
                                title="Supprimer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le transfert</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce transfert ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground">
              {deleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
