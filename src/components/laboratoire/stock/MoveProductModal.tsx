'use client';

import { useState } from 'react';
import type { LaboRack, LaboStockItem } from '@/lib/api';
import { Modal } from '@/components/laboratoire/shared/Modal';
import { RackPicker } from '@/components/laboratoire/shared/RackPicker';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function MoveProductModal({
  open,
  onClose,
  stock,
  racks,
  stockItems,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  stock: LaboStockItem | null;
  racks: LaboRack[];
  stockItems: LaboStockItem[];
  onConfirm: (payload: { stockId: number; rackId: number; stage: number; place: number }) => Promise<void>;
}) {
  const [selection, setSelection] = useState<{ rackId: number; stage: number; place: number; rackName: string } | null>(null);
  const [error, setError] = useState('');
  if (!stock) return null;
  return (
    <Modal open={open} onClose={onClose} title="Déplacer produit" size="lg">
      <Alert className="mb-4">
        <AlertDescription>
          {stock.produit} | Lot {stock.lot} | Qté {stock.qty} | Emplacement actuel : rack {stock.rackId}, étape {stock.stage}, place{' '}
          {stock.place}
        </AlertDescription>
      </Alert>
      <RackPicker
        racks={racks}
        stockItems={stockItems}
        currentStockId={stock.id}
        selectedRackId={selection?.rackId}
        selectedStage={selection?.stage}
        selectedPlace={selection?.place}
        onSelect={(rackId, stage, place, rackName) => {
          setSelection({ rackId, stage, place, rackName });
          setError('');
        }}
      />
      {selection ? (
        <p className="mt-2 text-sm text-primary">
          Sélection : {selection.rackName} / Étape {selection.stage} / Place {selection.place}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Annuler
        </Button>
        <Button
          type="button"
          onClick={async () => {
            if (!selection) {
              setError('Veuillez sélectionner un emplacement.');
              return;
            }
            await onConfirm({ stockId: stock.id, rackId: selection.rackId, stage: selection.stage, place: selection.place });
            onClose();
          }}
        >
          Confirmer le déplacement
        </Button>
      </div>
    </Modal>
  );
}
