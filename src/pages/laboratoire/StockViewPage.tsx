import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { laboratoireApi, type LaboRack, type LaboStockItem } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { StockViewClient } from '@/components/laboratoire/stock/StockViewClient';
import { StageModal } from '@/components/laboratoire/stock/StageModal';
import { useLaboratoirePageAccess } from './useLaboratoirePageAccess';

export default function LaboratoireStockViewPage() {
  const qc = useQueryClient();
  const { authLoading, roleLoading, canAccess } = useLaboratoirePageAccess();
  const enabled = canAccess && !authLoading && !roleLoading;

  const { data: racksRes } = useQuery({ queryKey: ['labo-racks'], queryFn: () => laboratoireApi.getRacks(), enabled });
  const { data: stockRes } = useQuery({
    queryKey: ['labo-stock-full'],
    queryFn: () => laboratoireApi.getStockFull(),
    enabled,
  });
  const racks = racksRes?.data || [];
  const stockItems = stockRes?.data || [];

  const [activeRack, setActiveRack] = useState<LaboRack | null>(null);
  const [activeStage, setActiveStage] = useState(0);
  const [stageRows, setStageRows] = useState<LaboStockItem[]>([]);

  const moveMutation = useMutation({
    mutationFn: ({ stockId, rackId, stage, place }: { stockId: number; rackId: number; stage: number; place: number }) =>
      laboratoireApi.moveProduct(stockId, { rackId, stage, place }),
    onSuccess: async () => {
      toast({ title: 'Produit déplacé.' });
      await qc.invalidateQueries({ queryKey: ['labo-stock-full'] });
    },
    onError: (e: unknown) =>
      toast({
        title: 'Erreur',
        description: e instanceof Error ? e.message : 'Erreur déplacement',
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
      <div className="p-4 md:p-6">
        <StockViewClient
          racks={racks}
          stockItems={stockItems}
          onOpenStage={async (r, stage) => {
            setActiveRack(r);
            setActiveStage(stage);
            const res = await laboratoireApi.getStageStock(r.id, stage);
            setStageRows(res.data || []);
          }}
        />

        <StageModal
          open={!!activeRack}
          onClose={() => {
            setActiveRack(null);
            setActiveStage(0);
            setStageRows([]);
          }}
          rack={activeRack}
          stage={activeStage}
          rows={stageRows}
          allRacks={racks}
          allStock={stockItems}
          onMove={async (payload) => {
            await moveMutation.mutateAsync(payload);
            if (activeRack && activeStage) {
              const res = await laboratoireApi.getStageStock(activeRack.id, activeStage);
              setStageRows(res.data || []);
            }
          }}
        />
      </div>
    </DashboardLayout>
  );
}
