'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { componentChangesApi, type ComponentChangeWithProducts, type FabOrderOption } from '@/lib/api';
import { OFCombobox } from './OFCombobox';
import { ComponentCombobox } from './ComponentCombobox';
import { toast } from '@/components/ui/sonner';

const schema = z
  .object({
    of_id: z.string().min(1, 'OF requis'),
    commande: z.string().min(1, 'Commande requise'),
    nom_du_produit: z.string().min(1, 'Nom du produit requis'),
    original_product_id: z.string().min(1, 'Composant original requis'),
    new_product_id: z.string().min(1, 'Nouveau composant requis'),
    qty: z.coerce.number().int().min(0, 'Quantité doit être ≥ 0').default(0),
    comment: z.string().optional(),
  })
  .refine((data) => data.original_product_id !== data.new_product_id, {
    message: 'Le nouveau composant doit être différent du composant original',
    path: ['new_product_id'],
  });

type FormValues = z.infer<typeof schema>;

interface ComponentChangeModalProps {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  editData?: ComponentChangeWithProducts | null;
  fabOrders: FabOrderOption[];
  onSuccess: () => void;
}

export function ComponentChangeModal({
  open,
  onClose,
  mode,
  editData,
  fabOrders,
  onSuccess,
}: ComponentChangeModalProps) {
  const [ofOption, setOfOption] = useState<FabOrderOption | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      of_id: '',
      commande: '',
      nom_du_produit: '',
      original_product_id: '',
      new_product_id: '',
      qty: 0,
      comment: '',
    },
  });

  const ofId = watch('of_id');
  const nomDuProduit = watch('nom_du_produit');
  const originalProductId = watch('original_product_id');
  const newProductId = watch('new_product_id');

  useEffect(() => {
    if (!open) {
      reset({
        of_id: '',
        commande: '',
        nom_du_produit: '',
        original_product_id: '',
        new_product_id: '',
        qty: 0,
        comment: '',
      });
      setOfOption(null);
      return;
    }
    if (mode === 'edit' && editData) {
      const of: FabOrderOption = {
        OFID: editData.ofId,
        saleOrderId: editData.commande,
        prodName: editData.nomDuProduit,
      };
      setOfOption(of);
      setValue('of_id', editData.ofId);
      setValue('commande', editData.commande);
      setValue('nom_du_produit', editData.nomDuProduit);
      setValue('original_product_id', editData.originalProductId);
      setValue('new_product_id', editData.newProductId);
      setValue('qty', editData.qty);
      setValue('comment', editData.comment ?? '');
      setTimeout(() => setOfOption(of), 0);
    }
  }, [open, mode, editData, reset, setValue]);

  const handleOfSelect = (of: FabOrderOption | null) => {
    setOfOption(of);
    if (of) {
      setValue('of_id', of.OFID);
      setValue('commande', of.saleOrderId);
      setValue('nom_du_produit', of.prodName);
      setValue('original_product_id', '');
      setValue('new_product_id', '');
    } else {
      setValue('of_id', '');
      setValue('commande', '');
      setValue('nom_du_produit', '');
      setValue('original_product_id', '');
      setValue('new_product_id', '');
    }
  };

  const onSubmit = async (data: FormValues) => {
    try {
      if (mode === 'edit' && editData?.id) {
        await componentChangesApi.update(editData.id, data);
        toast.success('Changement mis à jour.');
      } else {
        await componentChangesApi.create(data);
        toast.success('Changement enregistré.');
      }
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur lors de l\'enregistrement.';
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? 'Modifier le changement de composant' : 'Changement de composant'}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit, (err) => {
            const first = Object.values(err)[0];
            const msg = first?.message ?? 'Veuillez corriger les champs en erreur.';
            toast.error(msg);
          })}
          className="space-y-4 min-w-0"
        >
          <div className="space-y-1.5">
            <Label>OF</Label>
            <OFCombobox
              options={fabOrders}
              value={ofOption}
              onSelect={handleOfSelect}
              placeholder="Sélectionner un OF..."
            />
            {errors.of_id && <p className="text-sm text-destructive">{errors.of_id.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Commande</Label>
            <Input {...register('commande')} readOnly className="h-9 bg-muted min-w-0 overflow-x-auto" />
            {errors.commande && <p className="text-sm text-destructive">{errors.commande.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Produit</Label>
            <Input {...register('nom_du_produit')} readOnly className="h-9 bg-muted min-w-0 overflow-x-auto" title={watch('nom_du_produit')} />
            {errors.nom_du_produit && <p className="text-sm text-destructive">{errors.nom_du_produit.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Composant original</Label>
            <ComponentCombobox
              type="original"
              ofId={ofId}
              nomDuProduit={nomDuProduit}
              value={originalProductId}
              onChange={(code) => setValue('original_product_id', code, { shouldValidate: true })}
              disabled={!nomDuProduit}
              displayLabel={mode === 'edit' && editData ? editData.originalComponentName : undefined}
            />
            {errors.original_product_id && <p className="text-sm text-destructive">{errors.original_product_id.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Nouveau composant</Label>
            <ComponentCombobox
              type="new"
              ofId={ofId}
              value={newProductId}
              onChange={(code) => setValue('new_product_id', code, { shouldValidate: true })}
              excludeCode={originalProductId || undefined}
              displayLabel={mode === 'edit' && editData ? editData.newComponentName : undefined}
            />
            {errors.new_product_id && <p className="text-sm text-destructive">{errors.new_product_id.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Quantité</Label>
            <Input
              type="number"
              min={0}
              {...register('qty', { setValueAs: (v) => (v === '' || Number.isNaN(Number(v)) ? 0 : Number(v)) })}
              className="h-9"
            />
            {errors.qty && <p className="text-sm text-destructive">{errors.qty.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Commentaire</Label>
            <Textarea {...register('comment')} rows={2} placeholder="Commentaire..." className="resize-none" />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Fermer
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enregistrement...' : 'Sauvegarder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
