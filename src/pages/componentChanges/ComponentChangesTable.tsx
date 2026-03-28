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
import { TableColumnPicker } from '@/components/ui/table-column-picker';
import {
  useTableColumnVisibility,
  countVisibleTableColumns,
  type TableColumnDef,
} from '@/hooks/use-table-column-visibility';

const COMPONENT_CHANGES_COLUMNS: TableColumnDef[] = [
  { id: 'of', label: 'OF' },
  { id: 'commande', label: 'Commande' },
  { id: 'nom_produit', label: 'Nom du Produit' },
  { id: 'orig_name', label: 'Composant Original' },
  { id: 'orig_ref', label: 'Référence Original' },
  { id: 'new_name', label: 'Nouveau Composant' },
  { id: 'new_ref', label: 'Nouvelle Référence' },
  { id: 'qty', label: 'Quantité' },
  { id: 'statut', label: 'Statut' },
  { id: 'comment', label: 'Commentaire' },
  { id: 'date', label: 'Date' },
  { id: 'actions', label: 'Actions', required: true },
];

interface ComponentChangesTableProps {
  data: ComponentChangeWithProducts[];
  onRefresh: () => void;
  onEdit: (row: ComponentChangeWithProducts) => void;
}

export function ComponentChangesTable({ data, onRefresh, onEdit }: ComponentChangesTableProps) {
  const [optimisticStatus, setOptimisticStatus] = useState<Record<number, string>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { isVisible, toggle, reset, optionalColumns, visibility } = useTableColumnVisibility(
    'component-changes',
    COMPONENT_CHANGES_COLUMNS
  );
  const ccColSpan = countVisibleTableColumns(COMPONENT_CHANGES_COLUMNS, visibility, 0);

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
      <div className="mb-2 flex justify-end">
        <TableColumnPicker
          optionalColumns={optionalColumns}
          visibility={visibility}
          onToggle={toggle}
          onReset={reset}
        />
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {isVisible('of') && <TableHead>OF</TableHead>}
              {isVisible('commande') && <TableHead>Commande</TableHead>}
              {isVisible('nom_produit') && <TableHead>Nom du Produit</TableHead>}
              {isVisible('orig_name') && <TableHead>Composant Original</TableHead>}
              {isVisible('orig_ref') && <TableHead>Référence Original</TableHead>}
              {isVisible('new_name') && <TableHead>Nouveau Composant</TableHead>}
              {isVisible('new_ref') && <TableHead>Nouvelle Référence</TableHead>}
              {isVisible('qty') && <TableHead>Quantité</TableHead>}
              {isVisible('statut') && <TableHead>Statut</TableHead>}
              {isVisible('comment') && <TableHead>Commentaire</TableHead>}
              {isVisible('date') && <TableHead>Date</TableHead>}
              {isVisible('actions') && <TableHead className="w-[100px] text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={Math.max(ccColSpan, 1)}
                  className="py-8 text-center text-muted-foreground"
                >
                  Aucun changement de composant.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => {
                const status = getStatus(row);
                return (
                  <TableRow key={row.id}>
                    {isVisible('of') && <TableCell className="font-medium">{row.ofId}</TableCell>}
                    {isVisible('commande') && <TableCell>{row.commande}</TableCell>}
                    {isVisible('nom_produit') && <TableCell>{row.nomDuProduit}</TableCell>}
                    {isVisible('orig_name') && <TableCell>{row.originalComponentName}</TableCell>}
                    {isVisible('orig_ref') && <TableCell>{row.originalComponentCode}</TableCell>}
                    {isVisible('new_name') && <TableCell>{row.newComponentName}</TableCell>}
                    {isVisible('new_ref') && <TableCell>{row.newComponentCode}</TableCell>}
                    {isVisible('qty') && <TableCell>{row.qty}</TableCell>}
                    {isVisible('statut') && <TableCell>{status ?? '—'}</TableCell>}
                    {isVisible('comment') && (
                      <TableCell className="max-w-[200px] truncate">{row.comment ?? '—'}</TableCell>
                    )}
                    {isVisible('date') && <TableCell>{formatDate(row.createdAt)}</TableCell>}
                    {isVisible('actions') && (
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
                              className={status ? 'cursor-not-allowed opacity-50' : ''}
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
                    )}
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
