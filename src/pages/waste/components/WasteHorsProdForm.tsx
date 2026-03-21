'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, RotateCcw } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { wasteHorsProdApi, type CreateRebutHorsProdInput, type RebutHorsProdRow, type UpdateRebutHorsProdInput } from '@/lib/api';
import { StringCombobox } from './StringCombobox';
import { cn } from '@/lib/utils';

const createRebutSchema = z.object({
  produit: z.string().min(1, 'Nom du produit requis').max(255),
  composant: z.string().min(1, 'Nom du composant requis').max(255),
  qty: z.coerce.number().int().min(1, 'Quantité doit être >= 1'),
  defaut: z.string().min(1, 'Défaut requis').max(255),
  demandeur: z.string().min(1, 'Demandeur requis').max(255),
  commentaire: z.string().max(1000).optional(),
});

type FormValues = z.infer<typeof createRebutSchema>;

export function WasteHorsProdForm({
  mode,
  initialData,
  products,
  defauts,
  createdByLabel,
  onCancel,
  onSuccess,
}: {
  mode: 'create' | 'edit';
  initialData?: RebutHorsProdRow | null;
  products: string[];
  defauts: string[];
  createdByLabel: string;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [componentOptions, setComponentOptions] = useState<string[]>([]);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const schemaDefaultValues = useMemo<FormValues>(
    () => ({
      produit: initialData?.produit ?? '',
      composant: initialData?.composant ?? '',
      qty: initialData?.qty ?? 1,
      defaut: initialData?.defaut ?? '',
      demandeur: initialData?.demandeur ?? '',
      commentaire: initialData?.comment ?? '',
    }),
    [initialData]
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createRebutSchema),
    defaultValues: schemaDefaultValues,
    mode: 'onChange',
  });

  const produit = watch('produit');
  const composant = watch('composant');
  const commentaire = watch('commentaire') ?? '';

  // Load components whenever product changes
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const p = produit.trim();
      if (!p) {
        setComponentOptions([]);
        setValue('composant', '');
        return;
      }
      setLoadingComponents(true);
      try {
        const res = await wasteHorsProdApi.getComponentsByProduct(p);
        if (!mounted) return;
        setComponentOptions(res.data ?? []);

        // Keep existing selected component if still present; otherwise clear.
        if (composant && !res.data?.includes(composant)) {
          setValue('composant', '');
        }
      } catch (e) {
        console.error(e);
        if (mounted) setComponentOptions([]);
        setValue('composant', '');
      } finally {
        if (mounted) setLoadingComponents(false);
      }
    };
    load();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produit]);

  const onSubmit = async (values: FormValues) => {
    setSubmitLoading(true);
    try {
      if (mode === 'edit' && initialData) {
        const payload: UpdateRebutHorsProdInput = {
          produit: values.produit,
          composant: values.composant,
          qty: values.qty,
          defaut: values.defaut,
          demandeur: values.demandeur,
          commentaire: values.commentaire,
        };
        await wasteHorsProdApi.update(initialData.id, payload);
        toast.success('Rebut mis à jour.');
      } else {
        const payload: CreateRebutHorsProdInput = {
          produit: values.produit,
          composant: values.composant,
          qty: values.qty,
          defaut: values.defaut,
          demandeur: values.demandeur,
          commentaire: values.commentaire,
        };
        await wasteHorsProdApi.create(payload);
        toast.success('Rebut enregistré.');
      }
      onSuccess();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de l’enregistrement.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const commentLength = commentaire.length;
  const counterClass =
    commentLength > 900 ? 'text-destructive font-medium' : commentLength >= 800 ? 'text-yellow-600 font-medium' : 'text-muted-foreground';

  return (
    <div className="space-y-6 p-4 md:p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === 'edit' ? `Modifier le Rebut` : 'Nouveau Rebut Hors Production'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === 'edit' ? 'Mise à jour des informations' : 'Saisissez les informations du rebut'}
            </p>
          </div>
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-5">
            <h2 className="text-base font-bold uppercase tracking-[0.5px] text-[#5a5c69] mb-4">
              INFORMATIONS PRINCIPALES
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Nom du produit *</Label>
                <StringCombobox
                  options={products}
                  value={produit}
                  onChange={(v) => setValue('produit', v, { shouldValidate: true })}
                  placeholder="Sélectionner un produit..."
                />
                {errors.produit && <p className="text-sm text-destructive">{errors.produit.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Nom du composant *</Label>
                <StringCombobox
                  options={componentOptions}
                  value={composant}
                  onChange={(v) => setValue('composant', v, { shouldValidate: true })}
                  placeholder="Sélectionner un composant..."
                  disabled={!produit || loadingComponents}
                  loading={loadingComponents}
                />
                {errors.composant && <p className="text-sm text-destructive">{errors.composant.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Quantité *</Label>
                <Input
                  type="number"
                  min={1}
                  className="h-9"
                  {...register('qty')}
                />
                {errors.qty && <p className="text-sm text-destructive">{errors.qty.message}</p>}
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label>Défaut *</Label>
                <StringCombobox
                  options={defauts}
                  value={watch('defaut')}
                  onChange={(v) => setValue('defaut', v, { shouldValidate: true })}
                  placeholder="Sélectionner un défaut..."
                />
                {errors.defaut && <p className="text-sm text-destructive">{errors.defaut.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-5">
            <h2 className="text-base font-bold uppercase tracking-[0.5px] text-[#5a5c69] mb-4">
              INFORMATIONS UTILISATEUR
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Demandeur *</Label>
                <Input
                  {...register('demandeur')}
                  className="h-9"
                  placeholder="Saisissez le nom du demandeur"
                />
                {errors.demandeur && <p className="text-sm text-destructive">{errors.demandeur.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Créé par</Label>
                <Input value={createdByLabel} disabled className="h-9 bg-[#f8f9fa] text-[#6c757d] cursor-not-allowed" />
                {mode === 'edit' ? (
                  <p className="text-xs text-muted-foreground">
                    Ce champ ne peut pas être modifié (audit trail).
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Ce champ est automatiquement rempli avec votre nom d&apos;utilisateur.
                  </p>
                )}
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label>Commentaire</Label>
                <Textarea
                  {...register('commentaire')}
                  className="min-h-[80px] resize-y"
                  placeholder="Ajoutez un commentaire (optionnel)..."
                />
                <div className={cn('text-xs mt-1', counterClass)}>
                  {commentLength}/1000
                </div>
                {errors.commentaire && <p className="text-sm text-destructive mt-1">{errors.commentaire.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitLoading} className="border-[#d1d3e2] text-muted-foreground">
            <RotateCcw className="mr-2 h-4 w-4" />
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={submitLoading}
            className="bg-gradient-to-r from-[#28a745] to-[#20c997] text-white hover:shadow-lg translate-y-[-1px]"
          >
            {submitLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {submitLoading ? 'Enregistrement en cours...' : mode === 'edit' ? 'Mettre à jour' : 'Enregistrer le Rebut'}
          </Button>
        </div>
      </form>
    </div>
  );
}

