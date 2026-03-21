'use client';

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { wasteHorsProdApi } from '@/lib/api';
import { WasteHorsProdForm } from './components/WasteHorsProdForm';
import { toast } from '@/components/ui/sonner';

export default function WasteHorsProdEdit() {
  const navigate = useNavigate();
  const params = useParams();
  const id = params.id ? Number.parseInt(String(params.id), 10) : NaN;

  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();
  const canAccess = hasMenuAccess('/components/waste');

  const createdByFallback = user?.full_name ?? user?.email ?? '';

  const { data, isLoading } = useQuery({
    queryKey: ['waste-hors-prod-edit', id],
    queryFn: async () => {
      if (!Number.isFinite(id)) throw new Error('ID invalide');
      const [row, productsRes, defautsRes] = await Promise.all([
        wasteHorsProdApi.getById(id),
        wasteHorsProdApi.getProductNames(),
        wasteHorsProdApi.getDefauts(),
      ]);
      return {
        row,
        products: productsRes.data ?? [],
        defauts: defautsRes.data ?? [],
      };
    },
    enabled: !!canAccess && !!params.id && Number.isFinite(id),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!isLoading && data?.row && data.row.status === false) {
      toast.error('Cette entrée est verrouillée et ne peut pas être modifiée.');
      navigate('/components/waste');
    }
  }, [data, isLoading, navigate]);

  if (authLoading || roleLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!canAccess) {
    return (
      <DashboardLayout>
        <div className="p-4 text-destructive">Vous n&apos;avez pas accès à cette page.</div>
      </DashboardLayout>
    );
  }

  if (!data?.row) {
    return (
      <DashboardLayout>
        <div className="p-4 text-destructive">Rebut introuvable.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <WasteHorsProdForm
        mode="edit"
        initialData={data.row}
        products={data.products}
        defauts={data.defauts}
        createdByLabel={data.row.createdBy ?? createdByFallback}
        onCancel={() => navigate('/components/waste')}
        onSuccess={() => navigate('/components/waste')}
      />
    </DashboardLayout>
  );
}

