'use client';

import { useState } from 'react';
import { Modal } from '@/components/laboratoire/shared/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function DeclarationAddModal({
  open,
  onClose,
  produit,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  produit: string;
  onSubmit: (payload: { qty: number; lot: string }) => Promise<void>;
}) {
  const [qty, setQty] = useState(1);
  const [lot, setLot] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <Modal open={open} onClose={onClose} title="Ajouter déclaration">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          try {
            await onSubmit({ qty, lot });
            onClose();
            setQty(1);
            setLot('');
          } finally {
            setLoading(false);
          }
        }}
      >
        <div className="space-y-2">
          <Label>Produit</Label>
          <Input value={produit} readOnly className="bg-muted" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="decl-qty">Quantité</Label>
          <Input
            id="decl-qty"
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="decl-lot">N° Lot</Label>
          <Input id="decl-lot" placeholder="N° Lot" value={lot} onChange={(e) => setLot(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'En cours...' : 'Ajouter'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
