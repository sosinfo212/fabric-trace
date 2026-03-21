import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { MoreVertical, Plus, Search } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { packingApi } from '@/lib/api';
import { PackingForm } from '@/components/shipping/PackingForm';
import { ProductionDataModal } from '@/components/shipping/ProductionDataModal';
import { ExportModal } from '@/components/shipping/ExportModal';

export default function PackingIndexPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [openCreate, setOpenCreate] = useState(false);
  const [productionId, setProductionId] = useState<number | null>(null);
  const [exportId, setExportId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['packing-lists'],
    queryFn: () => packingApi.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: packingApi.create,
    onSuccess: async () => {
      toast({ title: 'Packing list créée.' });
      setOpenCreate(false);
      await qc.invalidateQueries({ queryKey: ['packing-lists'] });
    },
    onError: (e: unknown) =>
      toast({
        title: 'Erreur',
        description: e instanceof Error ? e.message : 'Erreur création.',
        variant: 'destructive',
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: packingApi.remove,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['packing-lists'] });
      const previous = qc.getQueryData<any[]>(['packing-lists']) || [];
      qc.setQueryData<any[]>(['packing-lists'], (old = []) => old.filter((row) => row.id !== id));
      return { previous };
    },
    onError: (_e, _id, context) => {
      if (context?.previous) qc.setQueryData(['packing-lists'], context.previous);
    },
    onSuccess: async () => {
      toast({ title: 'Packing list supprimée.' });
      await qc.invalidateQueries({ queryKey: ['packing-lists'] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: packingApi.duplicate,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['packing-lists'] });
    },
    onSuccess: async () => {
      toast({ title: 'Packing list dupliquée.' });
      await qc.invalidateQueries({ queryKey: ['packing-lists'] });
    },
  });

  const rows = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return data ?? [];
    return (data ?? []).filter((row) => JSON.stringify(row).toLowerCase().includes(q));
  }, [data, search]);

  return (
    <DashboardLayout>
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold">Packing Lists</h1>
          <div className="flex items-center gap-2">
            <div className="relative w-[300px]">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button className="bg-gradient-to-r from-[#28a745] to-[#20c997]" onClick={() => setOpenCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle Packing List
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#b4b0b0] text-[10px] font-extrabold uppercase text-[#212529]">
                <th className="p-[6px] text-center">Proforma</th>
                <th className="p-[6px] text-center">Client</th>
                <th className="p-[6px] text-center">Container</th>
                <th className="p-[6px] text-center">Date</th>
                <th className="p-[6px] text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="p-6 text-center text-muted-foreground" colSpan={5}>
                    Chargement...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="p-6 text-center text-muted-foreground" colSpan={5}>
                    Aucune Packing List enregistrée.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-[6px] text-center align-middle">{row.proforma}</td>
                    <td className="p-[6px] text-center align-middle">{row.client}</td>
                    <td className="p-[6px] text-center align-middle">{row.container}</td>
                    <td className="p-[6px] text-center align-middle">{new Date(row.date).toLocaleDateString('fr-FR')}</td>
                    <td className="p-[6px] text-center align-middle">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[200px]">
                          <DropdownMenuItem onClick={() => setExportId(row.id)}>Exporter Excel</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.open(`/shipping/packing/${row.id}/print`, '_blank')}>
                            Imprimer
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/shipping/packing/${row.id}/edit`)}>
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/shipping/packing/${row.id}`)}>Afficher</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setProductionId(row.id)}>Données de production</DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              if (!window.confirm('Dupliquer cette packing list ?')) return;
                              duplicateMutation.mutate(row.id);
                            }}
                          >
                            Dupliquer
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => {
                              if (!window.confirm('Supprimer cette packing list ?')) return;
                              deleteMutation.mutate(row.id);
                            }}
                          >
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-h-[92vh] max-w-7xl overflow-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle Packing List</DialogTitle>
          </DialogHeader>
          <PackingForm onSubmit={async (payload) => createMutation.mutateAsync(payload)} loading={createMutation.isPending} />
        </DialogContent>
      </Dialog>

      <ProductionDataModal open={!!productionId} packingListId={productionId} onClose={() => setProductionId(null)} />
      <ExportModal open={!!exportId} packingListId={exportId} onClose={() => setExportId(null)} />
    </DashboardLayout>
  );
}
