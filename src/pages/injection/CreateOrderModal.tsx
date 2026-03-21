import { useState, useEffect } from 'react';
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
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { injectionApi } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface CreateOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateOrderModal({ open, onOpenChange, onSuccess }: CreateOrderModalProps) {
  const [loading, setLoading] = useState(false);
  const [nextOf, setNextOf] = useState('');
  const [loadingOf, setLoadingOf] = useState(false);
  const [designation, setDesignation] = useState('');
  const [quantite, setQuantite] = useState('');
  const [datePlanification, setDatePlanification] = useState('');
  const [designationOptions, setDesignationOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (open) {
      setLoadingOf(true);
      injectionApi
        .getNextOf()
        .then(setNextOf)
        .finally(() => setLoadingOf(false));
      injectionApi.getDesignations().then((list) => {
        setDesignationOptions((list || []).map((d) => ({ value: d, label: d })));
      });
      setDesignation('');
      setQuantite('');
      setDatePlanification('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qte = parseInt(quantite, 10);
    if (!nextOf || !designation.trim() || !Number.isFinite(qte) || qte < 1 || !datePlanification) {
      return;
    }
    setLoading(true);
    try {
      await injectionApi.createOrder({
        of: nextOf,
        designation: designation.trim(),
        quantite: qte,
        date_planification: datePlanification,
      });
      toast({ title: 'Ordre créé avec succès' });
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      toast({ title: 'Erreur', description: err instanceof Error ? err.message : 'Erreur lors de la création.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvel ordre de fabrication</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>OF</Label>
            <Input value={loadingOf ? '...' : nextOf} readOnly className="bg-muted" />
            <p className="text-xs text-muted-foreground">L&apos;OF est généré automatiquement</p>
          </div>
          <div className="space-y-2">
            <Label>Désignation <span className="text-destructive">*</span></Label>
            <SearchableCombobox
              options={designationOptions}
              value={designation}
              onValueChange={setDesignation}
              placeholder="Choisir une désignation..."
              searchPlaceholder="Rechercher..."
            />
          </div>
          <div className="space-y-2">
            <Label>Quantité <span className="text-destructive">*</span></Label>
            <Input
              type="number"
              min={1}
              required
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <Label>Date planification <span className="text-destructive">*</span></Label>
            <Input
              type="datetime-local"
              required
              value={datePlanification}
              onChange={(e) => setDatePlanification(e.target.value)}
              className="h-9"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading || loadingOf}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
