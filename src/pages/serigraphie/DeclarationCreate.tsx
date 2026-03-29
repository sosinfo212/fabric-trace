import { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { serigraphieDeclarationApi, serigraphieRebutApi, type SerigraphieComponent } from '@/lib/api';
import { randomUuid } from '@/lib/randomUuid';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const STATUT_OPTIONS = ['Planifié', 'En cours', 'Réalisé', 'Suspendu', 'Cloturé'];
const DEFECT_OPTIONS = ['cassé', 'rayure'];

type QualityRow = {
  id: string;
  component_id: string;
  component_name: string;
  qty_nc: string;
  default: string;
  comment: string;
};

function decodeOFID(encoded: string): string {
  try {
    return decodeURIComponent(escape(atob(encoded)));
  } catch {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  }
}

export default function SerigraphieDeclarationCreatePage() {
  const { encodedOFID } = useParams<{ encodedOFID: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();
  const canAccess = hasMenuAccess('/serigraphie/declaration');

  const ofid = encodedOFID ? decodeOFID(encodedOFID) : '';

  const { data, isLoading, error } = useQuery({
    queryKey: ['serigraphie-declaration-create-form', encodedOFID],
    queryFn: () => serigraphieDeclarationApi.getCreateForm(encodedOFID!),
    enabled: !!encodedOFID && !!user && canAccess,
  });

  const planning = data?.planning as Record<string, unknown> | undefined;
  const components = (data?.components ?? []) as SerigraphieComponent[];

  const [date_debut, setDate_debut] = useState('');
  const [date_fin, setDate_fin] = useState('');
  const [qte_fab, setQte_fab] = useState('0');
  const [Mat_prod, setMat_prod] = useState('1');
  const [Mat_quality, setMat_quality] = useState('1');
  const [statut, setStatut] = useState('En cours');
  const [Comment, setComment] = useState('');
  const [qualityRows, setQualityRows] = useState<QualityRow[]>([]);

  useEffect(() => {
    if (planning?.statut) setStatut(String(planning.statut));
  }, [planning?.statut]);

  const createMutation = useMutation({
    mutationFn: (payload: {
      OFID: string;
      date_debut: string;
      date_fin: string;
      qte_fab: number;
      Mat_prod: number;
      Mat_quality: number;
      Comment: string;
      statut: string;
      qty_nc: Array<{ component?: string; component_name?: string; qty_nc?: number; default?: string; comment?: string }>;
    }) => serigraphieDeclarationApi.create(payload),
    onSuccess: () => {
      toast({ title: 'Déclaration enregistrée avec succès.' });
      navigate('/serigraphie/declaration');
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const addQualityRow = () => {
    setQualityRows((prev) => [
      ...prev,
      {
        id: randomUuid(),
        component_id: '',
        component_name: '',
        qty_nc: '',
        default: DEFECT_OPTIONS[0],
        comment: '',
      },
    ]);
  };

  const removeQualityRow = (id: string) => {
    setQualityRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateQualityRow = (id: string, field: keyof QualityRow, value: string) => {
    setQualityRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ofid) {
      toast({ title: 'OF introuvable.', variant: 'destructive' });
      return;
    }
    const qteFabNum = parseInt(qte_fab, 10);
    const matProdNum = parseInt(Mat_prod, 10);
    const matQualityNum = parseInt(Mat_quality, 10);
    if (!Number.isFinite(qteFabNum) || qteFabNum < 0) {
      toast({ title: 'Quantité fabriquée invalide (min 0).', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(matProdNum) || matProdNum < 0) {
      toast({ title: 'Nombre d\'agents production requis.', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(matQualityNum) || matQualityNum < 0) {
      toast({ title: 'Nombre d\'agents qualité requis.', variant: 'destructive' });
      return;
    }
    if (!date_debut.trim()) {
      toast({ title: 'Date de début requise.', variant: 'destructive' });
      return;
    }
    if (!date_fin.trim()) {
      toast({ title: 'Date de fin requise.', variant: 'destructive' });
      return;
    }
    const qtyNcPayload = qualityRows.map((r) => {
      const comp = components.find((c) => c.id === r.component_id);
      return {
        component: comp?.component_code ?? undefined,
        component_name: comp?.component_name ?? undefined,
        qty_nc: r.qty_nc ? parseInt(r.qty_nc, 10) : undefined,
        default: r.default || undefined,
        comment: r.comment || undefined,
      };
    });
    createMutation.mutate({
      OFID: ofid,
      date_debut: date_debut.trim().slice(0, 10),
      date_fin: date_fin.trim().slice(0, 10),
      qte_fab: qteFabNum,
      Mat_prod: matProdNum,
      Mat_quality: matQualityNum,
      Comment: Comment.trim() || undefined,
      statut,
      qty_nc: qtyNcPayload,
    });
  };

  if (authLoading || roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }
  if (!user || !canAccess) return <Navigate to="/" replace />;
  if (!encodedOFID || error || (data && !planning)) {
    toast({ title: 'OF introuvable.', variant: 'destructive' });
    return <Navigate to="/serigraphie/declaration" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Déclaration de production OF: {ofid}</h1>
              <p className="text-sm text-muted-foreground">Renseignez les champs puis enregistrez.</p>
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={createMutation.isPending || isLoading}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <input type="hidden" name="OFID" value={ofid} />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Résumé de la commande</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead>Instructions</TableHead>
                      <TableHead className="text-right">Qte Planifiée</TableHead>
                      <TableHead className="text-right">Qte Réelle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>{planning?.client ?? '—'}</TableCell>
                      <TableCell>{planning?.prod_des ?? '—'}</TableCell>
                      <TableCell className="max-w-xs truncate">{planning?.instruction ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-1 text-sm font-medium text-blue-800">
                          {planning?.qte_plan ?? 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-1 text-sm font-medium text-blue-800">
                          {planning?.qte_reel ?? 0}
                        </span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Déclaration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Date Début *</Label>
                    <Input
                      type="datetime-local"
                      value={date_debut}
                      onChange={(e) => setDate_debut(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date Fin *</Label>
                    <Input type="datetime-local" value={date_fin} onChange={(e) => setDate_fin(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantité Fabriquée</Label>
                    <Input type="number" min={0} value={qte_fab} onChange={(e) => setQte_fab(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Agent Production *</Label>
                    <Input type="number" min={0} value={Mat_prod} onChange={(e) => setMat_prod(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Agent Qualité *</Label>
                    <Input type="number" min={0} value={Mat_quality} onChange={(e) => setMat_quality(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Statut</Label>
                    <Select value={statut} onValueChange={setStatut}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUT_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Commentaire</Label>
                  <Textarea value={Comment} onChange={(e) => setComment(e.target.value)} rows={2} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Contrôle Qualité</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addQualityRow}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Composant</TableHead>
                      <TableHead className="text-right w-28">Quantité NC</TableHead>
                      <TableHead className="w-32">Défaut</TableHead>
                      <TableHead>Commentaire</TableHead>
                      <TableHead className="w-14" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {qualityRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                          Aucune ligne. Cliquez sur « Ajouter » pour en ajouter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      qualityRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Select
                              value={row.component_id}
                              onValueChange={(v) => {
                                const c = components.find((x) => x.id === v);
                                updateQualityRow(row.id, 'component_id', v);
                                updateQualityRow(row.id, 'component_name', c?.component_name ?? '');
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Composant" />
                              </SelectTrigger>
                              <SelectContent>
                                {components.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.component_code ? `[${c.component_code}] ` : ''}{c.component_name ?? ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={row.qty_nc}
                              onChange={(e) => updateQualityRow(row.id, 'qty_nc', e.target.value)}
                              className="text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Select value={row.default} onValueChange={(v) => updateQualityRow(row.id, 'default', v)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DEFECT_OPTIONS.map((d) => (
                                  <SelectItem key={d} value={d}>
                                    {d}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.comment}
                              onChange={(e) => updateQualityRow(row.id, 'comment', e.target.value)}
                              placeholder="Commentaire"
                            />
                          </TableCell>
                          <TableCell>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeQualityRow(row.id)} aria-label="Supprimer">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}
