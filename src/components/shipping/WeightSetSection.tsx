import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { packingApi, type WeightSet } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Trash2, Plus } from 'lucide-react';

type DraftRow = { item: string; qty: number };

export function WeightSetSection({
  packingListId,
  initialWeightSets,
  itemData,
  syncKey,
}: {
  packingListId: number;
  initialWeightSets: WeightSet[];
  itemData: Record<string, { weight: number; price: number }>;
  /** e.g. packing.updatedAt — when parent refetches, sync saved weight sets from server */
  syncKey?: string;
}) {
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [existing, setExisting] = useState<WeightSet[]>(initialWeightSets);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    setExisting(initialWeightSets);
    // Only when packing list revision changes (refetch); avoids resetting on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey]);

  const itemNames = useMemo(() => Object.keys(itemData), [itemData]);

  const addRow = () => setRows((prev) => [...prev, { item: itemNames[0] || '', qty: 1 }]);
  const removeDraft = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const save = async () => {
    const payload = rows.filter((r) => r.item && r.qty > 0).map((r) => ({ Item: r.item, Qty: r.qty }));
    if (!payload.length) {
      toast({ title: 'Aucune ligne valide', description: 'Ajoutez au moins un item avec quantité.' });
      return;
    }
    setSaving(true);
    try {
      await packingApi.storeWeightSets(packingListId, payload);
      const refreshed = await packingApi.getOne(packingListId);
      setExisting(refreshed.weightSets);
      setRows([]);
      toast({ title: 'Weight sets enregistrés.' });
    } catch (e) {
      toast({
        title: 'Erreur',
        description: e instanceof Error ? e.message : 'Échec de sauvegarde.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const clearAll = async () => {
    setClearing(true);
    try {
      await packingApi.clearWeightSets(packingListId);
      setExisting([]);
      toast({ title: 'Weight sets supprimés.' });
    } catch (e) {
      toast({
        title: 'Erreur',
        description: e instanceof Error ? e.message : 'Échec suppression.',
        variant: 'destructive',
      });
    } finally {
      setClearing(false);
    }
  };

  const removeExisting = async (id: number) => {
    const backup = existing;
    setExisting((prev) => prev.filter((w) => w.id !== id));
    try {
      await packingApi.deleteWeightSet(packingListId, id);
    } catch {
      setExisting(backup);
      toast({ title: 'Erreur', description: 'Suppression impossible.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h3 className="text-lg font-semibold">Weight Set Configuration</h3>

      <div className="space-y-2">
        <Button type="button" variant="outline" onClick={addRow}>
          <Plus className="mr-2 h-4 w-4" />
          Add Weight Set Item
        </Button>
        {rows.map((row, idx) => {
          const meta = itemData[row.item];
          const totalWeight = meta ? (row.qty * meta.weight) / 1000 : 0;
          const totalValue = meta ? row.qty * meta.price : 0;
          return (
            <div key={`${idx}-${row.item}`} className="grid grid-cols-1 gap-2 rounded-md border p-3 md:grid-cols-6">
              <Select
                value={row.item}
                onValueChange={(v) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, item: v } : r)))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Item" />
                </SelectTrigger>
                <SelectContent>
                  {itemNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                value={row.qty}
                onChange={(e) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, qty: Number(e.target.value || 1) } : r)))}
              />
              <Input value={meta?.weight ?? 0} disabled />
              <Input value={totalWeight.toFixed(3)} disabled />
              <Input value={meta?.price ?? 0} disabled />
              <div className="flex items-center gap-2">
                <Input value={totalValue.toFixed(2)} disabled />
                <Button type="button" size="icon" variant="destructive" onClick={() => removeDraft(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
        {rows.length > 0 ? (
          <div className="flex gap-2">
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? 'Enregistrement...' : 'Save Weight Sets'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setRows([])}>
              Annuler
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="destructive" onClick={clearAll} disabled={clearing}>
          {clearing ? 'Suppression...' : 'Clear All'}
        </Button>
      </div>

      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="p-2 text-left">Item</th>
              <th className="p-2 text-left">Qty</th>
              <th className="p-2 text-left">Unit Wt (g)</th>
              <th className="p-2 text-left">Total Wt (kg)</th>
              <th className="p-2 text-left">Unit Price (€)</th>
              <th className="p-2 text-left">Total Value (€)</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {existing.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4 text-center text-muted-foreground">
                  Aucun weight set.
                </td>
              </tr>
            ) : (
              existing.map((ws) => (
                <tr key={ws.id} className="border-t">
                  <td className="p-2">{ws.item}</td>
                  <td className="p-2">{ws.qty}</td>
                  <td className="p-2">{itemData[ws.item]?.weight ?? '-'}</td>
                  <td className="p-2">{ws.totalWeight.toFixed(3)}</td>
                  <td className="p-2">{ws.unitValue.toFixed(2)}</td>
                  <td className="p-2">{ws.totalValue.toFixed(2)}</td>
                  <td className="p-2">
                    <Button type="button" size="icon" variant="destructive" onClick={() => removeExisting(ws.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
