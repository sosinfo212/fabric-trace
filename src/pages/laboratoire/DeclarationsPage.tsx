import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { laboratoireApi, type LaboDeclaration, type LaboOrdreWithDeclarations } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { DeclarationsTable } from '@/components/laboratoire/declarations/DeclarationsTable';
import { DeclarationAddModal } from '@/components/laboratoire/declarations/DeclarationAddModal';
import { HistoriqueModal } from '@/components/laboratoire/declarations/HistoriqueModal';
import { CloturerFlow } from '@/components/laboratoire/declarations/CloturerFlow';
import { TableSkeleton } from '@/components/laboratoire/shared/TableSkeleton';
import { useLaboratoirePageAccess } from './useLaboratoirePageAccess';

export default function LaboratoireDeclarationsPage() {
  const qc = useQueryClient();
  const { authLoading, roleLoading, canAccess } = useLaboratoirePageAccess();
  const [selected, setSelected] = useState<LaboOrdreWithDeclarations | null>(null);
  const [openAdd, setOpenAdd] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);
  const [openCloseFlow, setOpenCloseFlow] = useState(false);
  const [historyRows, setHistoryRows] = useState<LaboDeclaration[]>([]);

  const enabled = canAccess && !authLoading && !roleLoading;

  const { data, isLoading } = useQuery({
    queryKey: ['labo-declarations'],
    queryFn: () => laboratoireApi.getDeclarations(),
    enabled,
  });
  const { data: racksRes } = useQuery({ queryKey: ['labo-racks'], queryFn: () => laboratoireApi.getRacks(), enabled });
  const { data: stockRes } = useQuery({
    queryKey: ['labo-stock-full'],
    queryFn: () => laboratoireApi.getStockFull(),
    enabled,
  });

  const rows = data?.data || [];
  const racks = racksRes?.data || [];
  const stockItems = stockRes?.data || [];

  const addMutation = useMutation({
    mutationFn: laboratoireApi.createDeclaration,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['labo-declarations'] });
      toast({ title: 'Déclaration ajoutée.' });
    },
    onError: (e: unknown) =>
      toast({
        title: 'Erreur',
        description: e instanceof Error ? e.message : 'Une erreur est survenue.',
        variant: 'destructive',
      }),
  });
  const assignMutation = useMutation({
    mutationFn: laboratoireApi.assignToStock,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['labo-stock-full'] });
    },
    onError: (e: unknown) =>
      toast({
        title: 'Erreur',
        description: e instanceof Error ? e.message : 'Erreur affectation',
        variant: 'destructive',
      }),
  });
  const closeMutation = useMutation({
    mutationFn: ({ id }: { id: number }) => laboratoireApi.setStatut(id, 'Cloture'),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['labo-declarations'] });
    },
  });

  const lastDeclaration = useMemo(
    () => (selected?.declarations?.[0] ? selected.declarations[0] : null),
    [selected]
  );

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
        <h1 className="text-2xl font-bold tracking-tight">Laboratoire — Déclaration fabrication</h1>
        {isLoading ? (
          <TableSkeleton />
        ) : (
          <DeclarationsTable
            rows={rows}
            onAdd={(row) => {
              setSelected(row);
              setOpenAdd(true);
            }}
            onHistory={async (row) => {
              setSelected(row);
              const res = await laboratoireApi.getHistorique(row.id);
              setHistoryRows(res.data || []);
              setOpenHistory(true);
            }}
            onCloseFlow={(row) => {
              setSelected(row);
              setOpenCloseFlow(true);
            }}
          />
        )}

        <DeclarationAddModal
          open={openAdd}
          onClose={() => setOpenAdd(false)}
          produit={selected?.produit || ''}
          onSubmit={async ({ qty, lot }) => {
            if (!selected) return;
            await addMutation.mutateAsync({ ofId: selected.id, produit: selected.produit, qty, lot });
          }}
        />

        <HistoriqueModal open={openHistory} onClose={() => setOpenHistory(false)} rows={historyRows} />

        <CloturerFlow
          open={openCloseFlow}
          onClose={() => setOpenCloseFlow(false)}
          produit={selected?.produit || ''}
          qty={selected?.qty || 0}
          lot={lastDeclaration?.lot || ''}
          declarationId={lastDeclaration?.id}
          racks={racks}
          stockItems={stockItems}
          onConfirm={async ({ rackId, stage, place, declarationId }) => {
            if (!selected) return;
            await assignMutation.mutateAsync({
              rackId,
              stage,
              place,
              produit: selected.produit,
              qty: selected.qty,
              lot: lastDeclaration?.lot || 'N/A',
              declarationId,
            });
            await closeMutation.mutateAsync({ id: selected.id });
            toast({ title: 'Fabrication clôturée et affectée au stock.' });
            await qc.invalidateQueries({ queryKey: ['labo-declarations'] });
          }}
        />
      </div>
    </DashboardLayout>
  );
}
