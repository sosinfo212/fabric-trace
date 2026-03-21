import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { TransfertForm } from '@/components/transfer/TransfertForm';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { transfertApi } from '@/lib/api';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';

export default function MovementsEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userName = user?.full_name || user?.email || '';

  const transfertId = id ? parseInt(id, 10) : NaN;
  const { data: transfert, isLoading, error } = useQuery({
    queryKey: ['transfert', transfertId],
    queryFn: () => transfertApi.getById(transfertId),
    enabled: Number.isInteger(transfertId),
  });

  if (Number.isNaN(transfertId)) {
    navigate('/transfer/movements');
    return null;
  }
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }
  if (error || !transfert) {
    navigate('/transfer/movements');
    return null;
  }

  const { role } = useUserRole();
  const isAdmin = role === 'admin';
  const isResponsableMagasinPF = role === 'responsable_magasin_pf';
  const isPrivilegedUser = isAdmin || isResponsableMagasinPF;

  let canEditAll = isPrivilegedUser;
  let canEditStatusOnly = false;
  if (!isPrivilegedUser) {
    if (transfert.statut === 'Récéptionné') {
      canEditAll = false;
    } else if (transfert.statut === 'Envoyé') {
      canEditAll = transfert.createdBy === userName;
      canEditStatusOnly = !canEditAll;
    } else {
      canEditAll = true;
    }
  }

  const infoBox = {
    createdBy: transfert.createdBy ?? undefined,
    updatedBy: transfert.updatedBy ?? undefined,
    createdAt: transfert.createdAt ? format(new Date(transfert.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr }) : undefined,
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Modifier le transfert #{transfert.id}</h1>
        <TransfertForm
          mode="edit"
          initialData={transfert}
          canEditAll={canEditAll}
          canEditStatusOnly={canEditStatusOnly}
          infoBox={infoBox}
        />
      </div>
    </DashboardLayout>
  );
}
