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
      <div className="flex items-center justify-between gap-4 py-2">
        <div className="flex items-center gap-2">
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
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[90px] text-center">N° Palette</TableHead>
              <TableHead>N° Commande</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Produit</TableHead>
              <TableHead className="w-[70px] text-center">Qty Box</TableHead>
              <TableHead className="w-[80px] text-center">Unit/Box</TableHead>
              <TableHead className="w-[70px] text-center">Qty Unit</TableHead>
              <TableHead className="w-[90px] text-center">Total Qty</TableHead>
              <TableHead className="w-[80px]">Mouvement</TableHead>
              <TableHead className="w-[110px]">Statut</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                  Aucun transfert à afficher
                </TableCell>
              </TableRow>
            ) : (
              displayList.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-center font-medium">{t.numPal}</TableCell>
                  <TableCell className="font-medium">{t.numComm}</TableCell>
                  <TableCell>{t.client}</TableCell>
                  <TableCell>{t.product}</TableCell>
                  <TableCell className="text-center">{t.qtyBox}</TableCell>
                  <TableCell className="text-center">{t.unitPerbox ?? '-'}</TableCell>
                  <TableCell className="text-center">{t.qtyUnit}</TableCell>
                  <TableCell className="text-center font-medium text-primary">
                    {t.totalQty ?? '-'}
                  </TableCell>
                  <TableCell>
                    <MouvementBadge mouvement={t.mouvement} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge statut={t.statut} />
                  </TableCell>
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
