'use client';

import { useState } from 'react';
import type { LaboRack, LaboStockItem } from '@/lib/api';
import { ConfirmDialog } from '@/components/laboratoire/shared/ConfirmDialog';
import { Modal } from '@/components/laboratoire/shared/Modal';
import { RackPicker } from '@/components/laboratoire/shared/RackPicker';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function CloturerFlow({
  open,
  onClose,
  produit,
  qty,
  lot,
  declarationId,
  racks,
  stockItems,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  produit: string;
  qty: number;
  lot: string;
  declarationId?: number;
  racks: LaboRack[];
  stockItems: LaboStockItem[];
  onConfirm: (payload: { rackId: number; stage: number; place: number; declarationId?: number }) => Promise<void>;
}) {
  const [step, setStep] = useState<'confirm' | 'assign'>('confirm');
  const [selection, setSelection] = useState<{ rackId: number; stage: number; place: number; rackName: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const closeAll = () => {
    setStep('confirm');
    setSelection(null);
    setError('');
    onClose();
  };

  return (
    <>
      <ConfirmDialog
        open={open && step === 'confirm'}
        title="Clôturer la fabrication"
        message={`Confirmez-vous que la fabrication du produit « ${produit} » est terminée ?`}
        confirmLabel="Clôturer"
        onCancel={closeAll}
        onConfirm={() => setStep('assign')}
      />

      <Modal open={open && step === 'assign'} onClose={closeAll} title="Clôturer et affecter au stock" size="lg">
        <Card className="mb-4">
          <CardContent className="grid gap-2 pt-6 text-sm md:grid-cols-3">
            <div>
              Produit : <span className="font-medium">{produit}</span>
            </div>
            <div>
              Lot : <span className="font-mono font-medium">{lot || '—'}</span>
            </div>
            <div>
              Qté : <span className="font-medium">{qty}</span>
            </div>
          </CardContent>
        </Card>
        <p className="mb-2 text-sm text-muted-foreground">Choisir un emplacement libre</p>
        <RackPicker
          racks={racks}
          stockItems={stockItems}
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
          <Button type="button" variant="outline" onClick={closeAll}>
            Annuler
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={async () => {
              if (!selection) {
                setError('Veuillez sélectionner un emplacement.');
                return;
              }
              setLoading(true);
              try {
                await onConfirm({ ...selection, declarationId });
                closeAll();
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? 'En cours...' : 'Clôturer et affecter'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
