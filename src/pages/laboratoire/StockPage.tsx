import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { laboratoireApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { WarehouseCard } from '@/components/laboratoire/stock/WarehouseCard';
import { StructureModal } from '@/components/laboratoire/stock/StructureModal';
import { ConfirmDialog } from '@/components/laboratoire/shared/ConfirmDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLaboratoirePageAccess } from './useLaboratoirePageAccess';

export default function LaboratoireStockPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { authLoading, roleLoading, canAccess } = useLaboratoirePageAccess();
  const [openStructure, setOpenStructure] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState('');

  const enabled = canAccess && !authLoading && !roleLoading;

  const { data } = useQuery({ queryKey: ['labo-racks'], queryFn: () => laboratoireApi.getRacks(), enabled });
  const { data: stockRes } = useQuery({
    queryKey: ['labo-stock-full'],
    queryFn: () => laboratoireApi.getStockFull(),
    enabled,
  });

  const racks = data?.data || [];
  const fifoRows = useMemo(
    () =>
      [...(stockRes?.data || [])].sort((a, b) => {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        if (ta === tb) return a.id - b.id;
        return ta - tb;
      }),
    [stockRes?.data]
  );
  const normalizedSearch = productSearch.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    if (!normalizedSearch) return fifoRows;
    return fifoRows.filter((row) => row.produit.toLowerCase().includes(normalizedSearch));
  }, [fifoRows, normalizedSearch]);

  const formatDateTime = (value?: string) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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
        <Card>
          <CardHeader>
            <CardTitle>Stock FIFO</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Rechercher par produit..."
              />
            </div>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>Emplacement</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length ? (
                    filteredRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.produit}</TableCell>
                        <TableCell>
                          {(row.rackName || `Rack ${row.rackId}`) + ` / Étape ${row.stage} / Place ${row.place}`}
                        </TableCell>
                        <TableCell>{formatDateTime(row.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        {normalizedSearch ? 'Aucun produit trouvé.' : 'Aucune donnée de stock.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
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
