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
import { injectionApi, type InjectionRebutHistoryItem } from '@/lib/api';
import { Loader2 } from 'lucide-react';

interface EditRebutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InjectionRebutHistoryItem;
  onSuccess: () => void;
}

export function EditRebutModal({ open, onOpenChange, item, onSuccess }: EditRebutModalProps) {
  const [loading, setLoading] = useState(false);
  const [defaut, setDefaut] = useState(item.defaut);
  const [cause, setCause] = useState(item.cause);
  const [quantite, setQuantite] = useState(String(item.quantite));
  const [defautOptions, setDefautOptions] = useState<{ value: string; label: string }[]>([]);
  const [causeOptions, setCauseOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (open && item) {
      injectionApi.getRebutOptions().then((opts) => {
        setDefautOptions((opts.defauts || []).map((d) => ({ value: d, label: d })));
        setCauseOptions((opts.causes || []).map((c) => ({ value: c, label: c })));
      });
      setDefaut(item.defaut);
      setCause(item.cause);
      setQuantite(String(item.quantite));
    }
  }, [open, item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qte = parseInt(quantite, 10);
    if (!defaut.trim() || !cause.trim() || !Number.isFinite(qte) || qte < 1) return;
    setLoading(true);
    try {
      await injectionApi.updateRebut(item.id, { defaut: defaut.trim(), cause: cause.trim(), quantite: qte });
      onSuccess();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier le rebut</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>OF</Label>
            <Input value={item.of} readOnly className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Composant</Label>
            <Input value={item.composant} readOnly className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Défaut <span className="text-destructive">*</span></Label>
            <SearchableCombobox options={defautOptions} value={defaut} onValueChange={setDefaut} placeholder="Défaut..." />
          </div>
          <div className="space-y-2">
            <Label>Causes <span className="text-destructive">*</span></Label>
            <SearchableCombobox options={causeOptions} value={cause} onValueChange={setCause} placeholder="Cause..." />
          </div>
          <div className="space-y-2">
            <Label>Quantité <span className="text-destructive">*</span></Label>
            <Input type="number" min={1} required value={quantite} onChange={(e) => setQuantite(e.target.value)} className="h-9" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
