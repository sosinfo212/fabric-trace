'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LaboOrdre, LaboStatut } from '@/lib/api';
import { productsApi } from '@/lib/api';
import { Modal } from '@/components/laboratoire/shared/Modal';
import { SearchableCombobox, type ComboboxOption } from '@/components/ui/searchable-combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

export function OrdreFormModal({
  open,
  onClose,
  initial,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  initial?: LaboOrdre | null;
  onSubmit: (payload: { produit: string; qty: number; instruction?: string; statut: LaboStatut }) => Promise<void>;
}) {
  const [produit, setProduit] = useState('');
  const [qty, setQty] = useState(1);
  const [instruction, setInstruction] = useState('');
  const [statut, setStatut] = useState<LaboStatut>('Planifier');
  const [loading, setLoading] = useState(false);

  const { data: productsRaw, isLoading: productsLoading } = useQuery({
    queryKey: ['products-all-labo-ordre-form'],
    queryFn: () => productsApi.getAll(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const productOptions = useMemo((): ComboboxOption[] => {
    const list = Array.isArray(productsRaw) ? productsRaw : [];
    const seen = new Set<string>();
    const opts: ComboboxOption[] = [];
    for (const p of list) {
      const name = String((p as { product_name?: string }).product_name ?? '').trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const ref = String((p as { ref_id?: string }).ref_id ?? '').trim();
      opts.push({
        value: name,
        label: ref ? `${name} [${ref}]` : name,
        searchTerms: [name, ref].filter(Boolean),
      });
    }
    opts.sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }));
    const legacy = initial?.produit?.trim();
    if (legacy && !seen.has(legacy)) {
      opts.unshift({
        value: legacy,
        label: `${legacy} (non référencé)`,
        searchTerms: [legacy],
      });
    }
    return opts;
  }, [productsRaw, initial?.produit]);

  useEffect(() => {
    if (!initial) {
      setProduit('');
      setQty(1);
      setInstruction('');
      setStatut('Planifier');
      return;
    }
    setProduit(initial.produit);
    setQty(initial.qty);
    setInstruction(initial.instruction || '');
    setStatut(initial.statut);
  }, [initial, open]);

  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose()}
      title={initial ? 'Modifier ordre' : 'Ajouter ordre'}
      subtitle="Ordre de fabrication laboratoire"
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!produit.trim()) {
            toast({
              title: 'Produit requis',
              description: 'Veuillez sélectionner un produit dans la liste.',
              variant: 'destructive',
            });
            return;
          }
          setLoading(true);
          try {
            await onSubmit({ produit: produit.trim(), qty, instruction, statut });
            onClose();
          } finally {
            setLoading(false);
          }
        }}
      >
        <div className="space-y-2">
          <Label>Produit</Label>
          {productsLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <SearchableCombobox
              options={productOptions}
              value={produit || undefined}
              onValueChange={setProduit}
              placeholder="Sélectionner un produit…"
              searchPlaceholder="Rechercher par nom ou référence…"
              emptyText="Aucun produit ne correspond."
              disabled={loading}
              className="h-10"
            />
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="labo-qty">Quantité</Label>
          <Input
            id="labo-qty"
            type="number"
            min={1}
            placeholder="Quantité"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="labo-instruction">Instruction (optionnel)</Label>
          <Textarea
            id="labo-instruction"
            placeholder="Instruction"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label>Statut</Label>
          <Select value={statut} onValueChange={(v) => setStatut(v as LaboStatut)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Planifier">Planifier</SelectItem>
              <SelectItem value="En_cours">En cours</SelectItem>
              <SelectItem value="Cloture">Clôturé</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => !loading && onClose()}>
            Annuler
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'En cours...' : initial ? 'Mettre à jour' : 'Ajouter'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
