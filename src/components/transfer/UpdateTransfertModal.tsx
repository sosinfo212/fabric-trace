import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { transfertApi } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface FormValues {
  numComm: string;
  client: string;
  product: string;
  numPal: number;
  qtyBox: number;
  unitPerbox: number;
  qtyUnit: number;
  totalQty: number;
  mouvement: string;
  statut: string;
  comment: string;
}

interface UpdateTransfertModalProps {
  transfertId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function UpdateTransfertModal({
  transfertId,
  open,
  onOpenChange,
  onSuccess,
}: UpdateTransfertModalProps) {
  const { data: transfert, isLoading } = useQuery({
    queryKey: ['transfert', transfertId],
    queryFn: () => transfertApi.getById(transfertId),
    enabled: open && transfertId > 0,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      numComm: '',
      client: '',
      product: '',
      numPal: 1,
      qtyBox: 0,
      unitPerbox: 0,
      qtyUnit: 0,
      totalQty: 0,
      mouvement: 'A->M',
      statut: 'Envoyé',
      comment: '',
    },
  });

  useEffect(() => {
    if (transfert) {
      reset({
        numComm: transfert.numComm,
        client: transfert.client,
        product: transfert.product,
        numPal: transfert.numPal,
        qtyBox: transfert.qtyBox,
        unitPerbox: transfert.unitPerbox ?? 0,
        qtyUnit: transfert.qtyUnit,
        totalQty: transfert.totalQty ?? transfert.qtyBox * (transfert.unitPerbox ?? 0) + transfert.qtyUnit,
        mouvement: transfert.mouvement,
        statut: transfert.statut,
        comment: transfert.comment ?? '',
      });
    }
  }, [transfert, reset]);

  const qtyBox = watch('qtyBox');
  const unitPerbox = watch('unitPerbox');
  const qtyUnit = watch('qtyUnit');
  const totalQty = useMemo(
    () => (qtyBox || 0) * (unitPerbox || 0) + (qtyUnit || 0),
    [qtyBox, unitPerbox, qtyUnit]
  );
  useEffect(() => {
    setValue('totalQty', totalQty);
  }, [totalQty, setValue]);

  const onSubmit = async (values: FormValues) => {
    try {
      await transfertApi.update(transfertId, {
        numComm: values.numComm,
        client: values.client,
        product: values.product,
        numPal: values.numPal,
        qtyBox: values.qtyBox,
        unitPerbox: values.unitPerbox,
        qtyUnit: values.qtyUnit,
        totalQty: values.totalQty,
        mouvement: values.mouvement,
        statut: values.statut,
        comment: values.comment || undefined,
      });
      toast.success('Transfert mis à jour');
      onSuccess();
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le transfert #{transfertId}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : transfert ? (
          <>
            <div className="rounded-lg border border-blue-200 bg-[#e3f2fd] px-3 py-2 text-sm">
              Créé par : {transfert.createdBy ?? '-'} | Dernière modification : {transfert.updatedBy ?? '-'} | Date :{' '}
              {transfert.createdAt ? format(new Date(transfert.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr }) : '-'}
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>N° Commande</Label>
                  <Input {...register('numComm')} />
                </div>
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Input {...register('client')} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Produit</Label>
                <Input {...register('product')} />
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="space-y-2 w-24">
                  <Label>N° Palette</Label>
                  <Input type="number" min={1} {...register('numPal', { valueAsNumber: true })} />
                </div>
                <div className="space-y-2 w-24">
                  <Label>Qté Boîtes</Label>
                  <Input type="number" min={0} {...register('qtyBox', { valueAsNumber: true })} />
                </div>
                <div className="space-y-2 w-24">
                  <Label>Unité/Boîte</Label>
                  <Input type="number" min={0} {...register('unitPerbox', { valueAsNumber: true })} />
                </div>
                <div className="space-y-2 w-24">
                  <Label>Qté Unités</Label>
                  <Input type="number" min={0} {...register('qtyUnit', { valueAsNumber: true })} />
                </div>
                <div className="space-y-2 w-24">
                  <Label>Total Qté</Label>
                  <div className="rounded border bg-muted/50 px-3 py-2 font-bold">{totalQty}</div>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="space-y-2 w-32">
                  <Label>Mouvement</Label>
                  <Select value={watch('mouvement')} onValueChange={(v) => setValue('mouvement', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A->M">{"A->M"}</SelectItem>
                      <SelectItem value="M->A">{"M->A"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 w-36">
                  <Label>Statut</Label>
                  <Select value={watch('statut')} onValueChange={(v) => setValue('statut', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Envoyé">Envoyé</SelectItem>
                      <SelectItem value="Récéptionné">Récéptionné</SelectItem>
                      <SelectItem value="Annulé">Annulé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Commentaire</Label>
                <Textarea {...register('comment')} rows={2} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Fermer
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
