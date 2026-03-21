import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fabricationApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function DeclarationHistoryPage() {
  const { ofId } = useParams<{ ofId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();

  const canAccess = hasMenuAccess('/workshop/declaration');

  const { data: fabricationList, isLoading } = useQuery({
    queryKey: ['fabrication-history-page', ofId],
    queryFn: () => fabricationApi.getByOFID(ofId!),
    enabled: !!user && canAccess && !!ofId,
  });

  if (authLoading || roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  if (!ofId) {
    return <Navigate to="/workshop/declaration" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/workshop/declaration')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Historique fabrication</h1>
            <p className="text-muted-foreground">OF: {ofId}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Liste des déclarations pour l&apos;OF sélectionné</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !fabricationList?.length ? (
              <p className="text-center text-muted-foreground py-8">Aucune déclaration pour cet OF.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Début prod.</TableHead>
                      <TableHead>Fin prod.</TableHead>
                      <TableHead>Lot Jus</TableHead>
                      <TableHead>Validité</TableHead>
                      <TableHead className="text-right">PF</TableHead>
                      <TableHead className="text-right">Set</TableHead>
                      <TableHead className="text-right">Tester</TableHead>
                      <TableHead>Effectif</TableHead>
                      <TableHead>Commentaire</TableHead>
                      <TableHead>Créé le</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fabricationList.map((row: any) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          {row.date_fabrication
                            ? format(new Date(row.date_fabrication), 'dd/MM/yyyy HH:mm', { locale: fr })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {row.End_Fab_date
                            ? format(new Date(row.End_Fab_date), 'dd/MM/yyyy HH:mm', { locale: fr })
                            : '-'}
                        </TableCell>
                        <TableCell>{row.Lot_Jus ?? '-'}</TableCell>
                        <TableCell>
                          {row.Valid_date
                            ? format(new Date(row.Valid_date), 'dd/MM/yyyy', { locale: fr })
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">{row.Pf_Qty ?? 0}</TableCell>
                        <TableCell className="text-right">{row.Set_qty ?? 0}</TableCell>
                        <TableCell className="text-right">{row.Tester_qty ?? 0}</TableCell>
                        <TableCell>{row.effectif_Reel ?? '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={row.Comment_chaine ?? ''}>
                          {row.Comment_chaine ?? '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {row.created_at
                            ? format(new Date(row.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
