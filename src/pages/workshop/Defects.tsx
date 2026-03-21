import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fabOrdersApi, chainsApi, clientsApi, qualityApi, defectsApi, productComponentsApi, type ConformityDetailRow } from '@/lib/api';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select as SelectForm,
  SelectContent as SelectFormContent,
  SelectItem as SelectFormItem,
  SelectTrigger as SelectFormTrigger,
  SelectValue as SelectFormValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { toast } from '@/hooks/use-toast';
import { Plus, Eye, Pencil, Loader2, RefreshCw, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';

type DeclarationOrder = {
  id: string;
  of_id: string;
  order_prod: string | null;
  chaine_id: string | null;
  statut_of: string | null;
  sale_order_id: string;
  lot_set: string;
  pf_qty: number;
  tester_qty: number;
  set_qty: number;
  date_planifiee: string | null;
  client_name: string | null;
  product_name: string | null;
  product_id?: string | null;
  prod_ref?: string | null;
  num_chaine: number | null;
};

const TYPE_PRODUCT_OPTIONS = [
  { value: 'PF', label: 'PF' },
  { value: 'Tester', label: 'Tester' },
  { value: 'Set', label: 'Set' },
] as const;

const RESP_OPTIONS = [
  { value: "Main d'oeuvre", label: "Main d'œuvre" },
  { value: 'Machine', label: 'Machine' },
  { value: 'Fournisseur', label: 'Fournisseur' },
] as const;

function computeConformityPercent(
  pfQty: number,
  testerQty: number,
  setQty: number,
  totalNC: number
): number | null {
  const total = pfQty + testerQty + setQty;
  if (total <= 0) return null;
  const conform = Math.max(0, total - totalNC);
  return Math.round((conform / total) * 1000) / 10;
}

export default function DefectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();

  const canAccess = hasMenuAccess('/workshop/defects');

  const [chefFilter, setChefFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [viewDetailsOFID, setViewDetailsOFID] = useState<string | null>(null);
  const [viewDetailsOrder, setViewDetailsOrder] = useState<DeclarationOrder | null>(null);
  const [editDetail, setEditDetail] = useState<ConformityDetailRow | null>(null);
  const [editForm, setEditForm] = useState({
    category_id: '',
    defect_id: '',
    component_name: '',
    qty_nc: 0,
    type_product: 'PF' as 'PF' | 'Tester' | 'Set',
    resp_defaut: "Main d'oeuvre" as "Main d'oeuvre" | 'Machine' | 'Fournisseur',
    comment: '',
  });

  const { data: chaines } = useQuery({
    queryKey: ['chaines'],
    queryFn: async () => {
      const data = await chainsApi.getAll();
      return data.map((c: { id: string; num_chaine: number; chef_de_chaine?: { full_name?: string; email?: string } }) => ({
        id: c.id,
        num_chaine: c.num_chaine,
        displayName: c.chef_de_chaine?.full_name || c.chef_de_chaine?.email || `Chaîne ${c.num_chaine}`,
      }));
    },
    enabled: !!user && canAccess,
  });

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.getAll(),
    enabled: !!user && canAccess,
  });

  const { data: ordersRaw, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['fab-orders-declaration'],
    queryFn: () => fabOrdersApi.getDeclaration() as Promise<DeclarationOrder[]>,
    enabled: !!user && canAccess,
  });

  const { data: conformityTotals } = useQuery({
    queryKey: ['quality-conformity-totals'],
    queryFn: () => qualityApi.getConformityTotals(),
    enabled: !!user && canAccess,
  });

  const orders = (() => {
    let data = ordersRaw ?? [];
    if (chefFilter !== 'all') data = data.filter((o) => o.chaine_id === chefFilter);
    if (clientFilter !== 'all') data = data.filter((o) => (o.client_name || '') === clientFilter);
    return data;
  })();

  const { data: conformityDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['quality-conformity', viewDetailsOFID],
    queryFn: () => qualityApi.getConformityByOFID(viewDetailsOFID!),
    enabled: !!viewDetailsOFID,
  });

  const { data: defectCategories } = useQuery({
    queryKey: ['defects-categories'],
    queryFn: () => defectsApi.getCategories(),
    enabled: !!user && (!!editDetail || !!viewDetailsOFID),
  });

  const { data: defectsList } = useQuery({
    queryKey: ['defects'],
    queryFn: () => defectsApi.getAll(),
    enabled: !!user && (!!editDetail || !!viewDetailsOFID),
  });

  const { data: editComponents } = useQuery({
    queryKey: ['product-components', viewDetailsOrder?.product_id],
    queryFn: () => productComponentsApi.getByProduct(viewDetailsOrder!.product_id!),
    enabled: !!viewDetailsOrder?.product_id,
  });

  const updateConformityMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof qualityApi.updateConformity>[1] }) =>
      qualityApi.updateConformity(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality-conformity', viewDetailsOFID] });
      queryClient.invalidateQueries({ queryKey: ['quality-conformity-totals'] });
      toast({ title: 'Détail mis à jour' });
      setEditDetail(null);
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  const handleViewDetails = (order: DeclarationOrder) => {
    setViewDetailsOrder(order);
    setViewDetailsOFID(order.of_id);
  };

  const handleCloseViewModal = () => {
    setViewDetailsOFID(null);
    setViewDetailsOrder(null);
    setEditDetail(null);
  };

  const handleEdit = (row: ConformityDetailRow) => {
    setEditDetail(row);
    setEditForm({
      category_id: row.category_id || '',
      defect_id: row.defect_id || '',
      component_name: row.component_name || '',
      qty_nc: row.qty_nc ?? 0,
      type_product: row.type_product || 'PF',
      resp_defaut: row.resp_defaut || "Main d'oeuvre",
      comment: row.comment || '',
    });
  };

  const handleEditSave = () => {
    if (!editDetail?.id) return;
    if (editForm.qty_nc < 1) {
      toast({ title: 'Qté NC doit être ≥ 1', variant: 'destructive' });
      return;
    }
    updateConformityMutation.mutate({
      id: editDetail.id,
      data: {
        category_id: editForm.category_id || undefined,
        defect_id: editForm.defect_id || null,
        component_name: editForm.component_name || null,
        qty_nc: editForm.qty_nc,
        type_product: editForm.type_product,
        resp_defaut: editForm.resp_defaut,
        comment: editForm.comment || null,
      },
    });
  };

  const defectsByCategory = (categoryId: string) =>
    (defectsList || []).filter((d: { category_id?: string }) => d.category_id === categoryId);

  if (authLoading || roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!canAccess) return <Navigate to="/" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Déclaration défaut</h1>
          <Button variant="outline" asChild>
            <Link to="/quality/charts">
              <BarChart3 className="h-4 w-4 mr-2" />
              Graphiques
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base uppercase tracking-wide">Filtres</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Chef de chaîne</Label>
                <Select value={chefFilter} onValueChange={setChefFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {chaines?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-muted-foreground">Client</Label>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {clients?.map((c: { id: string; name: string }) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base uppercase tracking-wide">Liste des OF</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              aria-label="Actualiser la liste"
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold uppercase"># OF</TableHead>
                      <TableHead className="font-semibold uppercase">Client</TableHead>
                      <TableHead className="font-semibold uppercase">Commande</TableHead>
                      <TableHead className="font-semibold uppercase">Produit</TableHead>
                      <TableHead className="font-semibold uppercase text-right">PF Qty</TableHead>
                      <TableHead className="font-semibold uppercase text-right">Tester Qty</TableHead>
                      <TableHead className="font-semibold uppercase text-right">Set Qty</TableHead>
                      <TableHead className="font-semibold uppercase text-right">% Conformité</TableHead>
                      <TableHead className="font-semibold uppercase text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          Aucun ordre trouvé
                        </TableCell>
                      </TableRow>
                    ) : (
                      orders.map((order) => {
                        const totalNC = conformityTotals?.[order.of_id] ?? 0;
                        const pct = computeConformityPercent(
                          order.pf_qty || 0,
                          order.tester_qty || 0,
                          order.set_qty || 0,
                          totalNC
                        );
                        return (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono">{order.of_id}</TableCell>
                            <TableCell>{order.client_name || '-'}</TableCell>
                            <TableCell>{order.sale_order_id}</TableCell>
                            <TableCell>{order.product_name || '-'}</TableCell>
                            <TableCell className="text-right">{order.pf_qty ?? 0}</TableCell>
                            <TableCell className="text-right">{order.tester_qty ?? 0}</TableCell>
                            <TableCell className="text-right">{order.set_qty ?? 0}</TableCell>
                            <TableCell className="text-right">
                              {pct != null ? `${pct} %` : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() =>
                                    navigate('/quality/create', {
                                      state: {
                                        OFID: order.of_id,
                                        fabOrderId: order.id,
                                        productId: order.product_id,
                                        ref_id: order.prod_ref || '',
                                        productName: order.product_name,
                                      },
                                    })
                                  }
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Déclarer
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewDetails(order)}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Détails
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View details modal */}
      <Dialog open={!!viewDetailsOFID} onOpenChange={(open) => !open && handleCloseViewModal()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" aria-describedby="view-details-desc">
          <DialogHeader>
            <DialogTitle>Détails conformité — OF: {viewDetailsOFID ?? '-'}</DialogTitle>
            <DialogDescription id="view-details-desc">
              Liste des détails de conformité et non-conformité pour cet ordre de fabrication.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto min-h-0">
            {detailsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold uppercase">Composant</TableHead>
                    <TableHead className="font-semibold uppercase">Défaut</TableHead>
                    <TableHead className="font-semibold uppercase text-right">Qté NC</TableHead>
                    <TableHead className="font-semibold uppercase">Type Produit</TableHead>
                    <TableHead className="font-semibold uppercase">Responsable</TableHead>
                    <TableHead className="font-semibold uppercase">Commentaire</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(conformityDetails || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Aucun détail pour cet OF
                      </TableCell>
                    </TableRow>
                  ) : (
                    (conformityDetails || []).map((row: ConformityDetailRow) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.component_name ?? '-'}</TableCell>
                        <TableCell>{row.anomaly_label ?? row.defect_label ?? '-'}</TableCell>
                        <TableCell className="text-right">{row.qty_nc ?? 0}</TableCell>
                        <TableCell>{row.type_product ?? '-'}</TableCell>
                        <TableCell>{row.resp_defaut ?? '-'}</TableCell>
                        <TableCell>{row.comment ?? '-'}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(row)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseViewModal}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit declaration modal */}
      <Dialog open={!!editDetail} onOpenChange={(open) => !open && setEditDetail(null)}>
        <DialogContent
          className="max-w-3xl w-[90vw] max-h-[90vh] overflow-y-auto"
          aria-describedby="edit-detail-desc"
        >
          <DialogHeader>
            <DialogTitle>Modifier le détail — OF: {viewDetailsOFID}</DialogTitle>
            <DialogDescription id="edit-detail-desc">
              Modifier les champs du détail de non-conformité.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 min-w-0">
            <div className="min-w-0">
              <Label>Catégorie défaut</Label>
              <SelectForm value={editForm.category_id} onValueChange={(v) => setEditForm((f) => ({ ...f, category_id: v }))}>
                <SelectFormTrigger>
                  <SelectFormValue placeholder="Choisir" />
                </SelectFormTrigger>
                <SelectFormContent>
                  {(defectCategories || []).map((c: { id: string; category_name: string }) => (
                    <SelectFormItem key={c.id} value={c.id}>
                      {c.category_name}
                    </SelectFormItem>
                  ))}
                </SelectFormContent>
              </SelectForm>
            </div>
            <div className="min-w-0">
              <Label>Liste défaut</Label>
              <SelectForm
                value={editForm.defect_id}
                onValueChange={(v) => setEditForm((f) => ({ ...f, defect_id: v }))}
              >
                <SelectFormTrigger>
                  <SelectFormValue placeholder="Choisir (optionnel)" />
                </SelectFormTrigger>
                <SelectFormContent>
                  {defectsByCategory(editForm.category_id).map((d: { id: string; label: string }) => (
                    <SelectFormItem key={d.id} value={d.id}>
                      {d.label}
                    </SelectFormItem>
                  ))}
                </SelectFormContent>
              </SelectForm>
            </div>
            <div className="min-w-0">
              <Label>Composant</Label>
              <SearchableCombobox
                className="min-h-9 h-auto whitespace-normal break-words"
                options={[
                  { value: '', label: '—' },
                  ...(editComponents || []).map((c: { id: string; component_name?: string | null }) => {
                    const name = (c.component_name ?? c.id).trim() || c.id;
                    return {
                      value: name,
                      label: name,
                      searchTerms: [name],
                    };
                  }),
                ]}
                value={editForm.component_name || ''}
                onValueChange={(v) => setEditForm((f) => ({ ...f, component_name: v }))}
                placeholder="Choisir un composant"
                searchPlaceholder="Rechercher un composant..."
                emptyText="Aucun composant trouvé."
              />
            </div>
            <div className="min-w-0">
              <Label>Qté NC *</Label>
              <Input
                type="number"
                min={1}
                value={editForm.qty_nc}
                onChange={(e) => setEditForm((f) => ({ ...f, qty_nc: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
            <div className="min-w-0">
              <Label>Type produit</Label>
              <SelectForm
                value={editForm.type_product}
                onValueChange={(v) => setEditForm((f) => ({ ...f, type_product: v as 'PF' | 'Tester' | 'Set' }))}
              >
                <SelectFormTrigger>
                  <SelectFormValue />
                </SelectFormTrigger>
                <SelectFormContent>
                  {TYPE_PRODUCT_OPTIONS.map((o) => (
                    <SelectFormItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectFormItem>
                  ))}
                </SelectFormContent>
              </SelectForm>
            </div>
            <div className="min-w-0">
              <Label>Responsabilité</Label>
              <SelectForm
                value={editForm.resp_defaut}
                onValueChange={(v) =>
                  setEditForm((f) => ({ ...f, resp_defaut: v as "Main d'oeuvre" | 'Machine' | 'Fournisseur' }))
                }
              >
                <SelectFormTrigger>
                  <SelectFormValue />
                </SelectFormTrigger>
                <SelectFormContent>
                  {RESP_OPTIONS.map((o) => (
                    <SelectFormItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectFormItem>
                  ))}
                </SelectFormContent>
              </SelectForm>
            </div>
            <div className="min-w-0">
              <Label>Commentaire</Label>
              <Textarea
                value={editForm.comment}
                onChange={(e) => setEditForm((f) => ({ ...f, comment: e.target.value }))}
                placeholder="Optionnel"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDetail(null)}>
              Annuler
            </Button>
            <Button onClick={handleEditSave} disabled={updateConformityMutation.isPending}>
              {updateConformityMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
