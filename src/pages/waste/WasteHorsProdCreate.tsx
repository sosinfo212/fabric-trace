'use client';

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { wasteHorsProdApi } from '@/lib/api';
import { WasteHorsProdForm } from './components/WasteHorsProdForm';

export default function WasteHorsProdCreate() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();
  const canAccess = hasMenuAccess('/components/waste');

  const createdByLabel = user?.full_name ?? user?.email ?? '';

  const { data, isLoading } = useQuery({
    queryKey: ['waste-hors-prod-create-lookups'],
    queryFn: async () => {
      const [productsRes, defautsRes] = await Promise.all([
        wasteHorsProdApi.getProductNames(),
        wasteHorsProdApi.getDefauts(),
      ]);
      return { products: productsRes.data ?? [], defauts: defautsRes.data ?? [] };
    },
    enabled: !!canAccess && !authLoading,
    staleTime: 60_000,
  });

  const products = data?.products ?? [];
  const defauts = data?.defauts ?? [];

  if (authLoading || roleLoading) {
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

  return (
    <DashboardLayout>
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[250px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <WasteHorsProdForm
          mode="create"
          products={products}
          defauts={defauts}
          createdByLabel={createdByLabel}
          onCancel={() => navigate('/components/waste')}
          onSuccess={() => navigate('/components/waste')}
        />
      )}
    </DashboardLayout>
  );
}

