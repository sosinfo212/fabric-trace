import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { transfertApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { ROLE_LABELS } from '@/types/roles';
import type { AppRole } from '@/types/roles';
import { SaleOrderCombobox } from './SaleOrderCombobox';
import { ProductCombobox } from './ProductCombobox';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { TransfertFabrication } from '@/types/transfert';

const createSchema = z.object({
  numComm: z.string().min(1, 'N° Commande requis').max(255),
  client: z.string().min(1, 'Client requis').max(255),
  product: z.string().min(1, 'Produit requis').max(255),
  prodRef: z.string().max(255).optional(),
  qtyBox: z.number().int().min(0, 'Qty Box doit être ≥ 0'),
  unitPerbox: z.number().int().min(0).optional(),
  qtyUnit: z.number().int().min(0).default(0),
  totalQty: z.number().int().min(0).optional(),
  numPal: z.number().int().min(1, 'N° Palette requis'),
  mouvement: z.string().min(1, 'Mouvement requis').max(255),
  statut: z.string().min(1, 'Statut requis').max(255),
  comment: z.string().max(1000).optional(),
});

type FormValues = z.infer<typeof createSchema>;

interface TransfertFormProps {
  mode: 'create' | 'edit';
  initialData?: TransfertFabrication | null;
  canEditAll?: boolean;
  canEditStatusOnly?: boolean;
  infoBox?: { createdBy?: string; updatedBy?: string; createdAt?: string };
}

export function TransfertForm({
  mode,
  initialData,
  canEditAll = true,
  canEditStatusOnly = false,
  infoBox,
}: TransfertFormProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role } = useUserRole();
  const userName = user?.full_name || user?.email || '';
  const roleLabel = role ? ROLE_LABELS[role as AppRole] : '';

  const isAgentLogistique = role === 'agent_logistique';
  const isAgentMagasin = role === 'agent_magasin';

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      numComm: initialData?.numComm ?? '',
      client: initialData?.client ?? '',
      product: initialData?.product ?? '',
      prodRef: initialData?.prodRef ?? '',
      qtyBox: initialData?.qtyBox ?? 0,
      unitPerbox: initialData?.unitPerbox ?? undefined,
      qtyUnit: initialData?.qtyUnit ?? 0,
      totalQty: initialData?.totalQty ?? undefined,
      numPal: initialData?.numPal ?? 1,
      mouvement: initialData?.mouvement ?? (isAgentLogistique ? 'A->M' : isAgentMagasin ? 'M->A' : 'A->M'),
      statut: initialData?.statut ?? 'Envoyé',
      comment: initialData?.comment ?? '',
    },
  });

  const qtyBox = watch('qtyBox');
  const unitPerbox = watch('unitPerbox');
  const qtyUnit = watch('qtyUnit');

  useEffect(() => {
    const total = (qtyBox || 0) * (unitPerbox || 0) + (qtyUnit || 0);
    setValue('totalQty', total);
  }, [qtyBox, unitPerbox, qtyUnit, setValue]);

  const mouvementOptions = useMemo(() => {
    if (isAgentLogistique) return [{ value: 'A->M', label: 'A->M (Atelier vers Magasin)' }];
    if (isAgentMagasin) return [{ value: 'M->A', label: 'M->A (Magasin vers Atelier)' }];
    return [
      { value: 'A->M', label: 'A->M (Atelier vers Magasin)' },
      { value: 'M->A', label: 'M->A (Magasin vers Atelier)' },
    ];
  }, [isAgentLogistique, isAgentMagasin]);
  const statutOptionsList = useMemo(() => {
    return mode === 'create'
      ? [{ value: 'Envoyé', label: 'Envoyé' }]
      : [
          { value: 'Envoyé', label: 'Envoyé' },
          { value: 'Récéptionné', label: 'Récéptionné' },
          { value: 'Annulé', label: 'Annulé' },
        ];
  }, [mode]);


  const disabled = !canEditAll;
  const statusOnly = !canEditAll && canEditStatusOnly;

  const onSubmit = async (values: FormValues) => {
    const payload = {
      numComm: values.numComm,
      client: values.client,
      product: values.product,
      prodRef: values.prodRef || undefined,
      qtyBox: values.qtyBox,
      unitPerbox: values.unitPerbox,
      qtyUnit: values.qtyUnit,
      totalQty: values.totalQty,
      numPal: values.numPal,
      mouvement: values.mouvement,
      statut: values.statut,
      comment: values.comment || undefined,
    };

    try {
      if (mode === 'create') {
        await transfertApi.create(payload);
        toast.success('Transfert créé');
        navigate('/transfer/movements');
      } else if (initialData?.id) {
        const updatePayload = statusOnly ? { statut: values.statut } : payload;
        await transfertApi.update(initialData.id, updatePayload);
        toast.success('Transfert mis à jour');
        navigate('/transfer/movements');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      if (typeof msg === 'string' && msg.includes('30')) {
        toast.warning(msg);
        if (initialData?.id) navigate(`/transfer/movements/${initialData.id}/edit`);
        else navigate('/transfer/movements');
      } else {
        toast.error(msg);
      }
    }
  };

  const totalQty = watch('totalQty');

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mode === 'create' ? 'Nouveau Transfert de Fabrication' : 'Modifier le transfert'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {infoBox && (
          <div className="rounded-lg border border-blue-200 bg-[#e3f2fd] px-3 py-2 text-sm">
            {infoBox.createdBy != null && `Créé par : ${infoBox.createdBy} | `}
            {infoBox.updatedBy != null && `Dernière modification : ${infoBox.updatedBy} | `}
            {infoBox.createdAt != null && `Date de création : ${infoBox.createdAt}`}
            {mode === 'create' && !infoBox.createdBy && (
              <>Créé par : {userName} | Rôle : {roleLabel} | Date de création : {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}</>
            )}
          </div>
        )}

        {mode === 'create' && isAgentLogistique && (
          <Alert>
            <AlertDescription>Vous pouvez créer des transferts A→M (Atelier vers Magasin).</AlertDescription>
          </Alert>
        )}
        {mode === 'create' && isAgentMagasin && (
          <Alert>
            <AlertDescription>Vous pouvez créer des transferts M→A (Magasin vers Atelier).</AlertDescription>
          </Alert>
        )}
        {mode === 'edit' && !canEditAll && !canEditStatusOnly && (
          <Alert variant="destructive">
            <AlertDescription>Transfert finalisé : Ce transfert a le statut Récéptionné et ne peut plus être modifié.</AlertDescription>
          </Alert>
        )}
        {mode === 'edit' && !canEditAll && canEditStatusOnly && (
          <Alert>
            <AlertDescription>Modification limitée : Vous ne pouvez modifier que le statut car vous n'êtes pas le créateur.</AlertDescription>
          </Alert>
        )}
        {mode === 'edit' && canEditAll && initialData?.statut === 'Envoyé' && (
          <Alert className="border-green-200 bg-green-50">
            <AlertDescription>Modification complète : Vous êtes le créateur. Vous pouvez modifier tous les champs.</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>N° Commande <span className="text-destructive">*</span></Label>
              <SaleOrderCombobox
                value={watch('numComm')}
                onValueChange={(id, designation) => {
                  setValue('numComm', id);
                  setValue('client', designation ?? '');
                }}
                disabled={disabled}
              />
              {errors.numComm && <p className="text-sm text-destructive">{errors.numComm.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Client <span className="text-destructive">*</span></Label>
              <Input
                {...register('client')}
                readOnly={mode === 'create'}
                disabled={mode === 'edit' && disabled}
                placeholder={mode === 'create' ? 'Sélectionnez d\'abord un N° Commande' : 'Client'}
                className={mode === 'create' ? 'bg-muted cursor-not-allowed' : ''}
              />
              {errors.client && <p className="text-sm text-destructive">{errors.client.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Produit <span className="text-destructive">*</span></Label>
            <ProductCombobox
              value={watch('product')}
              onValueChange={(name, refId) => {
                setValue('product', name);
                setValue('prodRef', refId);
              }}
              disabled={disabled}
            />
            {errors.product && <p className="text-sm text-destructive">{errors.product.message}</p>}
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2 w-20">
              <Label>N° Pal <span className="text-destructive">*</span></Label>
              <Input type="number" min={1} {...register('numPal', { valueAsNumber: true })} disabled={disabled} />
              {errors.numPal && <p className="text-sm text-destructive">{errors.numPal.message}</p>}
            </div>
            <div className="space-y-2 w-20">
              <Label>Qty Box <span className="text-destructive">*</span></Label>
              <Input type="number" min={0} {...register('qtyBox', { valueAsNumber: true })} disabled={disabled} />
              {errors.qtyBox && <p className="text-sm text-destructive">{errors.qtyBox.message}</p>}
            </div>
            <div className="space-y-2 w-24">
              <Label>Unit/Box</Label>
              <Input type="number" min={0} {...register('unitPerbox', { valueAsNumber: true })} disabled={disabled} />
            </div>
            <div className="space-y-2 w-24">
              <Label>Qty Unit <span className="text-destructive">*</span></Label>
              <Input type="number" min={0} {...register('qtyUnit', { valueAsNumber: true })} disabled={disabled} />
              {errors.qtyUnit && <p className="text-sm text-destructive">{errors.qtyUnit.message}</p>}
            </div>
            <div className="space-y-2 w-24">
              <Label>Total Qty</Label>
              <div className="rounded-md border bg-muted/50 px-3 py-2 font-bold text-blue-600">
                {totalQty ?? 0}
              </div>
            </div>
            <div className="space-y-2 w-48">
              <Label>Mouvement <span className="text-destructive">*</span></Label>
              <Select
                value={watch('mouvement')}
                onValueChange={(v) => setValue('mouvement', v)}
                disabled={disabled}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {mouvementOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 w-40">
              <Label>Statut <span className="text-destructive">*</span></Label>
              <Select
                value={watch('statut')}
                onValueChange={(v) => setValue('statut', v)}
                disabled={mode === 'create' || (disabled && !statusOnly)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statutOptionsList.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Commentaire</Label>
            <Textarea
              {...register('comment')}
              disabled={disabled}
              placeholder="Ajouter un commentaire (optionnel)..."
              maxLength={1000}
              className="min-h-[80px]"
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === 'create' ? 'Créer' : 'Enregistrer'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/transfer/movements')}>
              Annuler
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

