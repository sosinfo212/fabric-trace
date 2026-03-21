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
import { injectionApi, type InjectionOrder } from '@/lib/api';
import { Loader2 } from 'lucide-react';

interface EditOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: InjectionOrder;
  onSuccess: () => void;
}

function toDatetimeLocal(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

export function EditOrderModal({ open, onOpenChange, order, onSuccess }: EditOrderModalProps) {
  const [loading, setLoading] = useState(false);
  const [designation, setDesignation] = useState(order.designation);
  const [quantite, setQuantite] = useState(String(order.quantite));
  const [datePlanification, setDatePlanification] = useState(toDatetimeLocal(order.date_planification));
  const [designationOptions, setDesignationOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (open) {
      setDesignation(order.designation);
      setQuantite(String(order.quantite));
      setDatePlanification(toDatetimeLocal(order.date_planification));
      injectionApi.getDesignations().then((list) => {
        setDesignationOptions((list || []).map((d) => ({ value: d, label: d })));
      });
    }
  }, [open, order]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qte = parseInt(quantite, 10);
    if (!designation.trim() || !Number.isFinite(qte) || qte < 1 || !datePlanification) return;
    setLoading(true);
    try {
      await injectionApi.updateOrder(order.of, {
        designation: designation.trim(),
        quantite: qte,
        date_planification: datePlanification,
      });
      onSuccess();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier l&apos;ordre de fabrication</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>OF</Label>
            <Input value={order.of} readOnly className="bg-muted" />
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
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
