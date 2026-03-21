import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  qualityApi,
  defectsApi,
  productComponentsApi,
  productsApi,
} from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { toast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const EMPTY_SELECT_VALUE = "__none__";

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

type DetailRow = {
  id: string;
  category_id: string;
  defect_id: string;
  component_name: string;
  qty_nc: number;
};

function nextId() {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function QualityCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();

  const state = (location.state || {}) as {
    OFID?: string;
    fabOrderId?: string;
    productId?: string;
    ref_id?: string;
    productName?: string;
  };
  const OFID = searchParams.get('OFID') || searchParams.get('ofId') || state.OFID || '';
  const fabOrderId = searchParams.get('fabOrderId') || searchParams.get('fk_OFID') || state.fabOrderId || '';
  const productIdFromOF = searchParams.get('productId') || state.productId || '';
  const refIdParam = searchParams.get('ref_id') || state.ref_id || '';
  useEffect(() => {
    if (state.productName) setProductName(state.productName);
  }, [state.productName]);

  const canAccess = hasMenuAccess('/quality/create');

  const [productName, setProductName] = useState<string>('');
  const [totalNC, setTotalNC] = useState<number>(0);
  const [typeProduct, setTypeProduct] = useState<'PF' | 'Tester' | 'Set'>('PF');
  const [respDefaut, setRespDefaut] = useState<"Main d'oeuvre" | 'Machine' | 'Fournisseur'>("Main d'oeuvre");
  const [listeDefautId, setListeDefautId] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [detailRows, setDetailRows] = useState<DetailRow[]>([
    { id: nextId(), category_id: '', defect_id: '', component_name: '', qty_nc: 1 },
  ]);

  // Product of the selected OF: prefer product_id from fab_order, else resolve by ref_id
  const { data: productByRef } = useQuery({
    queryKey: ['products-by-ref', refIdParam],
    queryFn: async () => {
      const list = await productsApi.getAll();
      const found = (list as { ref_id?: string }[]).find((p) => p.ref_id === refIdParam);
      return found ?? null;
    },
    enabled: !!refIdParam && !!user && !productIdFromOF,
  });

  const { data: productById } = useQuery({
    queryKey: ['product-by-id', productIdFromOF],
    queryFn: async () => {
      const list = await productsApi.getAll();
      return (list as { id?: string }[]).find((p) => p.id === productIdFromOF) ?? null;
    },
    enabled: !!productIdFromOF && !!user,
  });

  const productId = productIdFromOF || productByRef?.id;
  const { data: components } = useQuery({
    queryKey: ['product-components', productId],
    queryFn: () => productComponentsApi.getByProduct(productId!),
    enabled: !!productId,
  });

  const { data: defectCategories } = useQuery({
    queryKey: ['defects-categories'],
    queryFn: () => defectsApi.getCategories(),
    enabled: !!user,
  });

  const { data: defectsList } = useQuery({
    queryKey: ['defects'],
    queryFn: () => defectsApi.getAll(),
    enabled: !!user,
  });

  useEffect(() => {
    const name = productById?.product_name ?? productByRef?.product_name;
    if (name) setProductName(name);
  }, [productById, productByRef]);

  const defectsByCategory = (categoryId: string) =>
    (defectsList || []).filter((d: { category_id?: string }) => d.category_id === categoryId);

  // Real-time: Total NC * = sum of all Qté NC lines
  const sumQtyNc = detailRows.reduce((s, r) => s + (r.qty_nc || 0), 0);
  useEffect(() => {
    setTotalNC(sumQtyNc);
  }, [sumQtyNc]);

  const addRow = () => {
    setDetailRows((prev) => [
      ...prev,
      { id: nextId(), category_id: '', defect_id: '', component_name: '', qty_nc: 1 },
    ]);
  };

  const removeRow = (id: string) => {
    setDetailRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  const updateRow = (id: string, field: keyof DetailRow, value: string | number) => {
    setDetailRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const createMutation = useMutation({
    mutationFn: () => {
      const totalNcComputed = detailRows.reduce((s, r) => s + (r.qty_nc || 0), 0);
      return qualityApi.createConformity({
        OFID: OFID.trim(),
        fab_order_id: fabOrderId || null,
        comment: comment || null,
        total_nc: totalNC > 0 ? totalNC : totalNcComputed,
        details: detailRows
          .filter((r) => r.category_id && r.qty_nc >= 1)
          .map((r) => ({
            category_id: r.category_id,
            defect_id: r.defect_id || null,
            component_name: r.component_name || null,
            qty_nc: r.qty_nc,
            type_product: typeProduct,
            resp_defaut: respDefaut,
            comment: comment || null,
          })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality-conformity-totals'] });
      queryClient.invalidateQueries({ queryKey: ['quality-conformity', OFID] });
      toast({ title: 'Déclaration enregistrée' });
      navigate('/workshop/defects');
    },
    onError: (err: Error) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!OFID.trim()) {
      toast({ title: 'OFID manquant', variant: 'destructive' });
      return;
    }
    const validRows = detailRows.filter((r) => r.category_id && r.qty_nc >= 1);
    if (validRows.length === 0) {
      toast({ title: 'Ajoutez au moins une ligne avec catégorie défaut et Qté NC ≥ 1', variant: 'destructive' });
      return;
    }
    const sumValid = validRows.reduce((s, r) => s + (r.qty_nc || 0), 0);
    if (totalNC !== sumValid) {
      toast({
        title: 'Total NC invalide',
        description: `Total NC (${totalNC}) doit être égal à la somme des Qté NC des lignes (${sumValid}).`,
        variant: 'destructive',
      });
      return;
    }
    if (totalNC < 0) {
      toast({ title: 'Total NC doit être ≥ 0', variant: 'destructive' });
      return;
    }
    createMutation.mutate();
  };

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
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/workshop/defects">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Déclaration défaut</h1>
            <p className="text-muted-foreground">
              OF: {OFID || '-'} — Produit: {productName || '-'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base uppercase tracking-wide">Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Total NC *</Label>
                  <Input
                    type="number"
                    min={0}
                    value={totalNC}
                    readOnly
                    className="bg-muted font-semibold"
                    title="Calculé automatiquement : somme des Qté NC des lignes ci-dessous"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    = somme des Qté NC des lignes (mise à jour automatique)
                  </p>
                </div>
                <div>
                  <Label>Type de produit</Label>
                  <Select value={typeProduct} onValueChange={(v) => setTypeProduct(v as 'PF' | 'Tester' | 'Set')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_PRODUCT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Responsabilité</Label>
                  <Select
                    value={respDefaut}
                    onValueChange={(v) => setRespDefaut(v as "Main d'oeuvre" | 'Machine' | 'Fournisseur')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RESP_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Liste défaut</Label>
                  <Select
                    value={listeDefautId || EMPTY_SELECT_VALUE}
                    onValueChange={(v) => setListeDefautId(v === EMPTY_SELECT_VALUE ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir (optionnel)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_SELECT_VALUE}>—</SelectItem>
                      {(defectsList || []).map((d: { id: string; label: string }) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Commentaire</Label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Optionnel"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base uppercase tracking-wide">Détails des défauts</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus className="h-4 w-4 mr-1" />
                Ajouter une ligne
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {detailRows.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 border rounded-lg items-end"
                  >
                    <div className="md:col-span-3">
                      <Label>Catégorie défaut</Label>
                      <Select
                        value={row.category_id}
                        onValueChange={(v) => {
                          updateRow(row.id, 'category_id', v);
                          updateRow(row.id, 'defect_id', '');
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir" />
                        </SelectTrigger>
                        <SelectContent>
                          {(defectCategories || []).map((c: { id: string; category_name: string }) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.category_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-3">
                      <Label>Composant</Label>
                      <SearchableCombobox
                        options={[
                          { value: '', label: '—' },
                          ...(components || []).map((c: { id: string; component_name?: string }) => {
                            const name = (c.component_name ?? c.id).trim() || c.id;
                            return {
                              value: name,
                              label: name,
                              searchTerms: [name],
                            };
                          }),
                        ]}
                        value={row.component_name || ''}
                        onValueChange={(v) => updateRow(row.id, 'component_name', v)}
                        placeholder="Choisir un composant"
                        searchPlaceholder="Rechercher un composant..."
                        emptyText="Aucun composant trouvé."
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Qté NC *</Label>
                      <Input
                        type="number"
                        min={1}
                        value={row.qty_nc}
                        onChange={(e) => updateRow(row.id, 'qty_nc', parseInt(e.target.value, 10) || 0)}
                      />
                    </div>
                    <div className="md:col-span-3 flex items-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(row.id)}
                        disabled={detailRows.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enregistrer
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link to="/workshop/defects">Annuler</Link>
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
