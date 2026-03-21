import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { laboratoireApi, type LaboOrdre } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { OrdresTable } from '@/components/laboratoire/ordres/OrdresTable';
import { OrdreFormModal } from '@/components/laboratoire/ordres/OrdreFormModal';
import { ConfirmDialog } from '@/components/laboratoire/shared/ConfirmDialog';
import { TableSkeleton } from '@/components/laboratoire/shared/TableSkeleton';
import { useLaboratoirePageAccess } from './useLaboratoirePageAccess';

export default function LaboratoireOrdresPage() {
  const qc = useQueryClient();
  const { authLoading, roleLoading, canAccess } = useLaboratoirePageAccess();
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<LaboOrdre | null>(null);
  const [toDelete, setToDelete] = useState<LaboOrdre | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['labo-ordres'],
    queryFn: () => laboratoireApi.getOrdres(),
    enabled: canAccess && !authLoading && !roleLoading,
  });

  const createMutation = useMutation({
    mutationFn: laboratoireApi.createOrdre,
    onSuccess: async () => {
      toast({ title: 'Ordre ajouté.' });
      await qc.invalidateQueries({ queryKey: ['labo-ordres'] });
    },
    onError: (e: unknown) =>
      toast({
        title: 'Erreur',
        description: e instanceof Error ? e.message : 'Une erreur est survenue.',
        variant: 'destructive',
      }),
  });
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: { produit: string; qty: number; instruction?: string; statut: 'Planifier' | 'En_cours' | 'Cloture' };
    }) => laboratoireApi.updateOrdre(id, payload),
    onSuccess: async () => {
      toast({ title: 'Ordre mis à jour.' });
      await qc.invalidateQueries({ queryKey: ['labo-ordres'] });
    },
    onError: (e: unknown) =>
      toast({
        title: 'Erreur',
        description: e instanceof Error ? e.message : 'Une erreur est survenue.',
        variant: 'destructive',
      }),
  });
  const deleteMutation = useMutation({
    mutationFn: laboratoireApi.deleteOrdre,
    onSuccess: async () => {
      toast({ title: 'Ordre supprimé.' });
      await qc.invalidateQueries({ queryKey: ['labo-ordres'] });
    },
    onError: (e: unknown) =>
      toast({
        title: 'Erreur',
        description: e instanceof Error ? e.message : 'Une erreur est survenue.',
        variant: 'destructive',
      }),
  });

  if (authLoading || roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[200px] items-center justify-center p-6">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!canAccess) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[200px] items-center justify-center p-6">
          <p className="text-muted-foreground">Accès non autorisé.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Laboratoire — Ordre de fabrication</h1>
          <Button
            onClick={() => {
              setEditing(null);
              setOpenForm(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Ajouter
          </Button>
        </div>

        {isLoading ? (
          <TableSkeleton />
        ) : (
          <OrdresTable
            rows={data?.data || []}
            onEdit={(row) => {
              setEditing(row);
              setOpenForm(true);
            }}
            onDelete={(row) => setToDelete(row)}
          />
        )}

        <OrdreFormModal
          open={openForm}
          onClose={() => setOpenForm(false)}
          initial={editing}
          onSubmit={async (payload) => {
            if (editing) await updateMutation.mutateAsync({ id: editing.id, payload });
            else await createMutation.mutateAsync(payload);
          }}
        />

        <ConfirmDialog
          open={!!toDelete}
          title="Supprimer ordre"
          message="Confirmer la suppression ?"
          confirmLabel="Supprimer"
          danger
          onCancel={() => setToDelete(null)}
          onConfirm={async () => {
            if (!toDelete) return;
            await deleteMutation.mutateAsync(toDelete.id);
            setToDelete(null);
          }}
        />
      </div>
    </DashboardLayout>
  );
}
