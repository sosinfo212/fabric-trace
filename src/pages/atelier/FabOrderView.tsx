import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fabOrdersApi, fabricationApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Pencil, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_COLORS: Record<string, string> = {
  'Planifié': 'bg-blue-100 text-blue-800',
  'En cours': 'bg-yellow-100 text-yellow-800',
  'Réalisé': 'bg-green-100 text-green-800',
  'Cloturé': 'bg-gray-100 text-gray-800',
  'Suspendu': 'bg-red-100 text-red-800',
};

export default function FabOrderViewPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();

  const canAccess = hasMenuAccess('/atelier/fab-orders');

  // Fetch order with chaine relation only
  const { data: order, isLoading } = useQuery({
    queryKey: ['fab-order', id],
    queryFn: async () => {
      return await fabOrdersApi.getById(id!);
    },
    enabled: !!user && !!id,
  });

  // Fetch fabrication declarations for this OF
  const { data: fabrications = [], isLoading: fabricationsLoading } = useQuery({
    queryKey: ['fabrication-history', order?.of_id],
    queryFn: () => fabricationApi.getByOFID(order!.of_id),
    enabled: !!user && !!order?.of_id,
  });

  // Status update mutation
  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      await fabOrdersApi.update(id!, { statut_of: status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fab-order', id] });
      queryClient.invalidateQueries({ queryKey: ['fab-orders'] });
      toast({ title: 'Statut mis à jour' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  if (authLoading || roleLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (!canAccess) {
    navigate('/');
    return null;
  }

  if (!order) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Ordre non trouvé</p>
          <Button onClick={() => navigate('/atelier/fab-orders')} className="mt-4">
            Retour à la liste
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const totalQty = order.pf_qty + order.tester_qty + order.set_qty;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/atelier/fab-orders')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <h1 className="text-3xl font-bold">Ordre: {order.of_id}</h1>
            <Badge className={STATUS_COLORS[order.statut_of] || 'bg-gray-100'}>
              {order.statut_of}
            </Badge>
          </div>
          <div className="flex gap-2">
            {order.statut_of !== 'Réalisé' && (
              <Button
                variant="outline"
                onClick={() => statusMutation.mutate('Réalisé')}
                disabled={statusMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Marquer Réalisé
              </Button>
            )}
            <Button onClick={() => navigate(`/atelier/fab-orders/${id}/edit`)}>
              <Pencil className="h-4 w-4 mr-2" />
              Modifier
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations Générales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">OF ID</p>
                  <p className="font-medium font-mono">{order.of_id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">N° Commande</p>
                  <p className="font-medium">{order.sale_order_id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Client</p>
                  <p className="font-medium">{order.client_id || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Chaîne</p>
                  <p className="font-medium">
                    {order.chaines?.num_chaine ? `Chaîne ${order.chaines.num_chaine}` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date de Création</p>
                  <p className="font-medium">
                    {format(new Date(order.creation_date_of), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date de Fabrication</p>
                  <p className="font-medium">
                    {order.date_fabrication
                      ? format(new Date(order.date_fabrication), 'dd/MM/yyyy', { locale: fr })
                      : '-'}
                  </p>
                </div>
                {order.end_prod && (
                  <div>
                    <p className="text-sm text-muted-foreground">Date de Fin</p>
                    <p className="font-medium">
                      {format(new Date(order.end_prod), 'dd/MM/yyyy', { locale: fr })}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Produit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nom du Produit</p>
                  <p className="font-medium">{order.prod_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Référence</p>
                  <p className="font-medium font-mono">{order.prod_ref || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lot/Set</p>
                  <p className="font-medium">{order.lot_set || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Order Prod</p>
                  <p className="font-medium">{order.order_prod || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quantités</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">PF Qty</p>
                  <p className="text-2xl font-bold">{order.pf_qty}</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">SF Qty</p>
                  <p className="text-2xl font-bold">{order.sf_qty}</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Set Qty</p>
                  <p className="text-2xl font-bold">{order.set_qty}</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Tester Qty</p>
                  <p className="text-2xl font-bold">{order.tester_qty}</p>
                </div>
                <div className="text-center p-4 bg-primary/10 rounded-lg border-2 border-primary">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold text-primary">{totalQty}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Instructions & Commentaires</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Instructions</p>
                <p className="p-3 bg-muted rounded-lg min-h-[60px]">
                  {order.instruction || 'Aucune instruction'}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Commentaire</p>
                <p className="p-3 bg-muted rounded-lg min-h-[60px]">
                  {order.comment || 'Aucun commentaire'}
                </p>
              </div>
              {order.comment_chaine && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Commentaire Chaîne</p>
                    <p className="p-3 bg-muted rounded-lg min-h-[60px]">
                      {order.comment_chaine}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Placeholder sections for future relations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Qualité</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Aucune donnée de qualité disponible
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fabrications</CardTitle>
            </CardHeader>
            <CardContent>
              {fabricationsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : fabrications.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucune déclaration enregistrée
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date déclaration</TableHead>
                        <TableHead className="text-right">PF</TableHead>
                        <TableHead className="text-right">Set</TableHead>
                        <TableHead className="text-right">Tester</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Créé par</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fabrications.map((row: { id: number; created_at?: string; Pf_Qty?: number; Set_qty?: number; Tester_qty?: number; created_by?: string; created_by_name?: string }) => {
                        const total = (row.Pf_Qty ?? 0) + (row.Set_qty ?? 0) + (row.Tester_qty ?? 0);
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="whitespace-nowrap">
                              {row.created_at
                                ? format(new Date(row.created_at), 'd MMM yyyy', { locale: fr })
                                : '-'}
                            </TableCell>
                            <TableCell className="text-right">{row.Pf_Qty ?? 0}</TableCell>
                            <TableCell className="text-right">{row.Set_qty ?? 0}</TableCell>
                            <TableCell className="text-right">{row.Tester_qty ?? 0}</TableCell>
                            <TableCell className="text-right font-medium">{total}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {row.created_by_name || row.created_by || '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Détails de Conformité</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Aucun détail de conformité
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
