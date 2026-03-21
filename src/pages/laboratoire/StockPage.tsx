import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { laboratoireApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { WarehouseCard } from '@/components/laboratoire/stock/WarehouseCard';
import { StructureModal } from '@/components/laboratoire/stock/StructureModal';
import { ConfirmDialog } from '@/components/laboratoire/shared/ConfirmDialog';
import { useLaboratoirePageAccess } from './useLaboratoirePageAccess';

export default function LaboratoireStockPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { authLoading, roleLoading, canAccess } = useLaboratoirePageAccess();
  const [openStructure, setOpenStructure] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const enabled = canAccess && !authLoading && !roleLoading;

  const { data } = useQuery({ queryKey: ['labo-racks'], queryFn: () => laboratoireApi.getRacks(), enabled });

  const racks = data?.data || [];

  const addMutation = useMutation({
    mutationFn: laboratoireApi.createRack,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['labo-racks'] });
      toast({ title: 'Rack ajouté.' });
    },
    onError: (e: unknown) =>
      toast({
        title: 'Erreur',
        description: e instanceof Error ? e.message : 'Une erreur est survenue.',
        variant: 'destructive',
      }),
  });
  const deleteMutation = useMutation({
    mutationFn: laboratoireApi.deleteRack,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['labo-racks'] });
      toast({ title: 'Rack supprimé.' });
    },
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
        <h1 className="text-2xl font-bold tracking-tight">Laboratoire — Stock</h1>
        <WarehouseCard onStructure={() => setOpenStructure(true)} onView={() => navigate('/laboratoire/stock/view')} />
        <StructureModal
          open={openStructure}
          onClose={() => setOpenStructure(false)}
          racks={racks}
          onAdd={(payload) => addMutation.mutateAsync(payload)}
          onDelete={async (id) => setDeleteId(id)}
        />
        <ConfirmDialog
          open={deleteId != null}
          title="Supprimer rack"
          message="Confirmer la suppression ?"
          confirmLabel="Supprimer"
          danger
          onCancel={() => setDeleteId(null)}
          onConfirm={async () => {
            if (deleteId == null) return;
            await deleteMutation.mutateAsync(deleteId);
            setDeleteId(null);
          }}
        />
      </div>
    </DashboardLayout>
  );
}
