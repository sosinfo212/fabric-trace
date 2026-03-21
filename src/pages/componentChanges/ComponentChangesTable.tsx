'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { MoreVertical, Check, Pencil, Trash2 } from 'lucide-react';
import { componentChangesApi, type ComponentChangeWithProducts } from '@/lib/api';
import { toast } from '@/components/ui/sonner';

interface ComponentChangesTableProps {
  data: ComponentChangeWithProducts[];
  onRefresh: () => void;
  onEdit: (row: ComponentChangeWithProducts) => void;
}

export function ComponentChangesTable({ data, onRefresh, onEdit }: ComponentChangesTableProps) {
  const [optimisticStatus, setOptimisticStatus] = useState<Record<number, string>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const getStatus = (row: ComponentChangeWithProducts) => optimisticStatus[row.id] ?? row.status ?? null;

  const handleValidate = async (id: number) => {
    const row = data.find((r) => r.id === id);
    if (row?.status) return;
    const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    const pendingStatus = `Validée par ... ${dateStr}`;
    setOptimisticStatus((prev) => ({ ...prev, [id]: pendingStatus }));
    try {
      const res = await componentChangesApi.validate(id);
      setOptimisticStatus((prev) => ({ ...prev, [id]: res.status }));
      onRefresh();
    } catch (e: unknown) {
      setOptimisticStatus((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la validation.');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await componentChangesApi.delete(id);
      toast.success('Changement supprimé.');
      setDeleteId(null);
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    const date = new Date(d);
    return isNaN(date.getTime()) ? '—' : format(date, 'dd/MM/yyyy', { locale: fr });
  };

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>OF</TableHead>
              <TableHead>Commande</TableHead>
              <TableHead>Nom du Produit</TableHead>
              <TableHead>Composant Original</TableHead>
              <TableHead>Référence Original</TableHead>
              <TableHead>Nouveau Composant</TableHead>
              <TableHead>Nouvelle Référence</TableHead>
              <TableHead>Quantité</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Commentaire</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                  Aucun changement de composant.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => {
                const status = getStatus(row);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.ofId}</TableCell>
                    <TableCell>{row.commande}</TableCell>
                    <TableCell>{row.nomDuProduit}</TableCell>
                    <TableCell>{row.originalComponentName}</TableCell>
                    <TableCell>{row.originalComponentCode}</TableCell>
                    <TableCell>{row.newComponentName}</TableCell>
                    <TableCell>{row.newComponentCode}</TableCell>
                    <TableCell>{row.qty}</TableCell>
                    <TableCell>{status ?? '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{row.comment ?? '—'}</TableCell>
                    <TableCell>{formatDate(row.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleValidate(row.id)}
                            disabled={!!status}
                            className={status ? 'opacity-50 cursor-not-allowed' : ''}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Valider
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(row)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteId(row.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment supprimer ce changement de composant ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId != null && handleDelete(deleteId)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
