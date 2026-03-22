import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { packingApi, type CreatePackingListInput } from '@/lib/api';
import { PackingForm, type PackingFormHandle } from '@/components/shipping/PackingForm';
import { WeightSetSection } from '@/components/shipping/WeightSetSection';

export default function PackingEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const packingListId = Number(id);
  const formRef = useRef<PackingFormHandle>(null);
  const [savingHeader, setSavingHeader] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['packing-list', packingListId],
    queryFn: async () => {
      const [packing, itemData] = await Promise.all([
        packingApi.getOne(packingListId),
        packingApi.getWeightSetItemData(),
      ]);
      return { packing, itemData };
    },
    enabled: Number.isFinite(packingListId),
    /** Always refetch when opening edit so we never show only stale cache after a previous save. */
    refetchOnMount: 'always',
  });

  const updateMutation = useMutation({
    mutationFn: (payload: CreatePackingListInput) => packingApi.update(packingListId, payload),
    onSuccess: async () => {
      toast({ title: 'Packing list mise à jour.' });
      await queryClient.invalidateQueries({ queryKey: ['packing-list', packingListId] });
      await queryClient.invalidateQueries({ queryKey: ['packing-lists'] });
      navigate('/shipping/packing');
    },
    onError: (e: unknown) =>
      toast({
        title: 'Erreur',
        description: e instanceof Error ? e.message : 'Échec de mise à jour.',
        variant: 'destructive',
      }),
  });

  return (
    <DashboardLayout>
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Modifier Packing List</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={savingHeader}
              onClick={async () => {
                setSavingHeader(true);
                try {
                  await formRef.current?.saveHeaderFields();
                } finally {
                  setSavingHeader(false);
                }
              }}
            >
              {savingHeader ? 'Enregistrement...' : 'Sauvegarder'}
            </Button>
            <Button variant="outline" onClick={() => navigate('/shipping/packing')}>
              Fermer
            </Button>
          </div>
        </div>

        {isLoading || !data ? (
          <div className="rounded border p-8 text-center text-muted-foreground">Chargement...</div>
        ) : (
          <div className="space-y-4">
            <PackingForm
              ref={formRef}
              packingListId={packingListId}
              initial={data.packing}
              showAdvancedFields
              loading={updateMutation.isPending}
              onSubmit={async (payload) => updateMutation.mutateAsync(payload)}
            />
            <WeightSetSection
              packingListId={packingListId}
              initialWeightSets={data.packing.weightSets}
              itemData={data.itemData}
              syncKey={data.packing.updatedAt}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
