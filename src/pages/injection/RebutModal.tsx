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
import { injectionApi, type InjectionRebutOrderRow } from '@/lib/api';
import { Loader2, Trash2, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface RebutRow {
  id: string;
  defaut: string;
  cause: string;
  quantite: string;
}

interface RebutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: InjectionRebutOrderRow;
  onSuccess: () => void;
}

export function RebutModal({ open, onOpenChange, order, onSuccess }: RebutModalProps) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<RebutRow[]>([{ id: '1', defaut: '', cause: '', quantite: '' }]);
  const [defautOptions, setDefautOptions] = useState<{ value: string; label: string }[]>([]);
  const [causeOptions, setCauseOptions] = useState<{ value: string; label: string }[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      injectionApi.getRebutOptions().then((opts) => {
        setDefautOptions((opts.defauts || []).map((d) => ({ value: d, label: d })));
        setCauseOptions((opts.causes || []).map((c) => ({ value: c, label: c })));
      });
      setRows([{ id: String(Date.now()), defaut: '', cause: '', quantite: '' }]);
      setError('');
    }
  }, [open, order]);

  const addRow = () => {
    setRows((prev) => [...prev, { id: String(Date.now()), defaut: '', cause: '', quantite: '' }]);
  };

  const removeRow = (id: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  const updateRow = (id: string, field: keyof RebutRow, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const rebuts = rows
      .map((r) => {
        const qte = parseInt(r.quantite, 10);
        if (!r.defaut.trim() || !r.cause.trim() || !Number.isFinite(qte) || qte < 1) return null;
        return { defaut: r.defaut.trim(), cause: r.cause.trim(), quantite: qte };
      })
      .filter(Boolean) as Array<{ defaut: string; cause: string; quantite: number }>;
    if (rebuts.length === 0) {
      setError('Veuillez ajouter au moins une ligne avec défaut, cause et quantité > 0.');
      return;
    }
    setLoading(true);
    try {
      const result = await injectionApi.createRebuts({
        of: order.of,
        composant: order.designation,
        rebuts,
      });
      onSuccess();
      onOpenChange(false);
      const count = result?.count ?? rebuts.length;
      toast({ title: count === 1 ? '1 déclaration rebut créée avec succès' : `${count} déclarations rebut créées avec succès` });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter une déclaration rebut - OF: {order.of}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md bg-muted p-3 text-sm">
            <p><span className="font-medium">OF :</span> {order.of}</p>
            <p><span className="font-medium">Composant :</span> {order.designation}</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Lignes rebut</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus className="h-4 w-4 mr-1" />
                Ajouter une ligne
              </Button>
            </div>
            {rows.map((row) => (
              <div key={row.id} className="rounded-lg border p-3 flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[120px] space-y-1">
                  <Label className="text-xs">Défaut *</Label>
                  <SearchableCombobox
                    options={defautOptions}
                    value={row.defaut}
                    onValueChange={(v) => updateRow(row.id, 'defaut', v)}
                    placeholder="Défaut..."
                  />
                </div>
                <div className="flex-1 min-w-[120px] space-y-1">
                  <Label className="text-xs">Causes *</Label>
                  <SearchableCombobox
                    options={causeOptions}
                    value={row.cause}
                    onValueChange={(v) => updateRow(row.id, 'cause', v)}
                    placeholder="Cause..."
                  />
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-xs">Quantité *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={row.quantite}
                    onChange={(e) => updateRow(row.id, 'quantite', e.target.value)}
                    className="h-9"
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 text-red-600 shrink-0"
                  onClick={() => removeRow(row.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
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
