import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { TransfertForm } from '@/components/transfer/TransfertForm';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ROLE_LABELS } from '@/types/roles';
import type { AppRole } from '@/types/roles';
import { useUserRole } from '@/hooks/useUserRole';

export default function MovementsCreatePage() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const userName = user?.full_name || user?.email || '';
  const roleLabel = role ? ROLE_LABELS[role as AppRole] : '';

  const infoBox = {
    createdBy: userName,
    updatedBy: undefined,
    createdAt: format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr }),
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Nouveau transfert</h1>
        <TransfertForm
          mode="create"
          infoBox={infoBox}
          canEditAll={true}
          canEditStatusOnly={false}
        />
      </div>
    </DashboardLayout>
  );
}
