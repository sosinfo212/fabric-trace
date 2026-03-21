import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { packingApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

export function ProductionDataModal({ open, packingListId, onClose }: { open: boolean; packingListId: number | null; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [proforma, setProforma] = useState('');
  const [items, setItems] = useState<
    Array<{
      id: number;
      designation: string;
      batch_nbr: string;
      manufacturing_date: string | null;
      expiry_date: string | null;
    }>
  >([]);

  useEffect(() => {
    if (!open || !packingListId) return;
    setLoading(true);
    packingApi
      .getItemsForProduction(packingListId)
      .then((data) => {
        setProforma(data.proforma);
        setItems(data.items);
      })
      .catch((e) =>
        toast({
          title: 'Erreur',
          description: e instanceof Error ? e.message : 'Impossible de charger les données.',
          variant: 'destructive',
        }),
      )
      .finally(() => setLoading(false));
  }, [open, packingListId]);

  const save = async () => {
    if (!packingListId) return;
    setSaving(true);
    try {
      await packingApi.updateProductionData(
        packingListId,
        items.map((row) => ({
          id: row.id,
          batch_nbr: row.batch_nbr || null,
          manufacturing_date: row.manufacturing_date || null,
          expiry_date: row.expiry_date || null,
        })),
      );
      toast({ title: 'Succès', description: 'Données de production enregistrées.' });
      onClose();
    } catch (e) {
      toast({
        title: 'Erreur',
        description: e instanceof Error ? e.message : 'Échec enregistrement.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(n) => !n && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Données de production — {proforma || '-'}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-10 text-center text-muted-foreground">Chargement...</div>
        ) : (
          <>
            <div className="max-h-[420px] overflow-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="p-2 text-left">Désignation</th>
                    <th className="p-2 text-left">Batch N°</th>
                    <th className="p-2 text-left">Date fabrication</th>
                    <th className="p-2 text-left">Date expiration</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="p-2">{row.designation}</td>
                      <td className="p-2">
                        <Input
                          value={row.batch_nbr || ''}
                          onChange={(e) =>
                            setItems((prev) => prev.map((it) => (it.id === row.id ? { ...it, batch_nbr: e.target.value } : it)))
                          }
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="date"
                          value={(row.manufacturing_date || '').slice(0, 10)}
                          onChange={(e) =>
                            setItems((prev) => prev.map((it) => (it.id === row.id ? { ...it, manufacturing_date: e.target.value } : it)))
                          }
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="date"
                          value={(row.expiry_date || '').slice(0, 10)}
                          onChange={(e) =>
                            setItems((prev) => prev.map((it) => (it.id === row.id ? { ...it, expiry_date: e.target.value } : it)))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
