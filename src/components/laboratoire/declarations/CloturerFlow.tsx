'use client';

import { useMemo, useState } from 'react';
import type { LaboDeclaration, LaboRack, LaboStockItem } from '@/lib/api';
import { ConfirmDialog } from '@/components/laboratoire/shared/ConfirmDialog';
import { Modal } from '@/components/laboratoire/shared/Modal';
import { RackPicker } from '@/components/laboratoire/shared/RackPicker';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function CloturerFlow({
  open,
  onClose,
  produit,
  declarations,
  racks,
  stockItems,
  onAssignDeclaration,
  onAssignMerged,
  onCloseOrder,
}: {
  open: boolean;
  onClose: () => void;
  produit: string;
  declarations: LaboDeclaration[];
  racks: LaboRack[];
  stockItems: LaboStockItem[];
  onAssignDeclaration: (payload: {
    rackId: number;
    stage: number;
    place: number;
    declaration: LaboDeclaration;
  }) => Promise<void>;
  onAssignMerged: (payload: {
    rackId: number;
    stage: number;
    place: number;
    declarations: LaboDeclaration[];
  }) => Promise<void>;
  onCloseOrder: () => Promise<void>;
}) {
  const [step, setStep] = useState<'confirm' | 'assign'>('confirm');
  const [selection, setSelection] = useState<{ rackId: number; stage: number; place: number; rackName: string } | null>(null);
  const [assignedIds, setAssignedIds] = useState<number[]>([]);
  const [selectedDeclarationId, setSelectedDeclarationId] = useState<number | null>(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const assignedInStock = useMemo(
    () =>
      new Set(
        stockItems
          .map((s) => s.declarationId)
          .filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
      ),
    [stockItems]
  );

  const selectedDeclaration = useMemo(
    () =>
      declarations.find((d) => d.id === selectedDeclarationId) ||
      declarations.find((d) => !assignedInStock.has(d.id)) ||
      declarations[0] ||
      null,
    [declarations, selectedDeclarationId, assignedInStock]
  );

  const unassignedDeclarations = useMemo(
    () => declarations.filter((d) => !assignedInStock.has(d.id) && !assignedIds.includes(d.id)),
    [declarations, assignedInStock, assignedIds]
  );

  const mergedQty = useMemo(
    () => unassignedDeclarations.reduce((sum, d) => sum + (Number(d.qty) || 0), 0),
    [unassignedDeclarations]
  );

  const allAssigned = useMemo(
    () => declarations.length > 0 && declarations.every((d) => assignedInStock.has(d.id) || assignedIds.includes(d.id)),
    [declarations, assignedInStock, assignedIds]
  );

  const closeAll = () => {
    setStep('confirm');
    setSelection(null);
    setAssignedIds([]);
    setSelectedDeclarationId(null);
    setMergeMode(false);
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
          <CardContent className="space-y-3 pt-6 text-sm">
            <p className="text-sm font-medium">Historique des déclarations (sélectionnez une déclaration à affecter)</p>
            <div className="rounded-md border border-dashed p-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={mergeMode}
                  onChange={(e) => {
                    setMergeMode(e.target.checked);
                    setError('');
                  }}
                />
                Fusionner les déclarations non affectées en une seule affectation
              </label>
              {mergeMode ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {unassignedDeclarations.length} déclaration(s) non affectée(s) seront fusionnées (Qté totale : {mergedQty}).
                </p>
              ) : null}
            </div>
            <div className="max-h-52 overflow-auto rounded-md border">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    {['', 'Produit', 'Lot', 'Qté', 'Date début', 'Date fin', 'Statut'].map((h) => (
                      <th key={h} className="border-b bg-muted/60 px-2 py-2 text-left font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {declarations.map((d) => {
                    const isAssigned = assignedInStock.has(d.id) || assignedIds.includes(d.id);
                    const isSelected = selectedDeclaration?.id === d.id;
                    return (
                      <tr
                        key={d.id}
                        className={isSelected ? 'bg-primary/5' : undefined}
                        onClick={() => {
                          if (!isAssigned) setSelectedDeclarationId(d.id);
                        }}
                      >
                        <td className="border-b px-2 py-2 align-middle">
                          <input
                            type="radio"
                            checked={isSelected}
                            disabled={isAssigned || mergeMode}
                            onChange={() => setSelectedDeclarationId(d.id)}
                            aria-label={`Sélectionner déclaration ${d.id}`}
                          />
                        </td>
                        <td className="border-b px-2 py-2">{d.produit}</td>
                        <td className="border-b px-2 py-2 font-mono">{d.lot || '—'}</td>
                        <td className="border-b px-2 py-2">{d.qty}</td>
                        <td className="border-b px-2 py-2">{d.dateDebut ? new Date(d.dateDebut).toLocaleString('fr-FR') : '—'}</td>
                        <td className="border-b px-2 py-2">{d.dateFin ? new Date(d.dateFin).toLocaleString('fr-FR') : '—'}</td>
                        <td className="border-b px-2 py-2">
                          {isAssigned ? (
                            <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-700">Affectée</span>
                          ) : (
                            <span className="rounded bg-amber-100 px-2 py-1 text-amber-700">À affecter</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {selectedDeclaration ? (
              <div className="grid gap-2 rounded-md border p-3 md:grid-cols-3">
                <div>
                  Produit : <span className="font-medium">{mergeMode ? produit : selectedDeclaration.produit}</span>
                </div>
                <div>
                  Lot :{' '}
                  <span className="font-mono font-medium">
                    {mergeMode
                      ? `${new Set(unassignedDeclarations.map((d) => d.lot).filter(Boolean)).size} lot(s)`
                      : selectedDeclaration.lot || '—'}
                  </span>
                </div>
                <div>
                  Qté : <span className="font-medium">{mergeMode ? mergedQty : selectedDeclaration.qty}</span>
                </div>
              </div>
            ) : null}
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
              if (mergeMode && unassignedDeclarations.length === 0) {
                setError('Toutes les déclarations sont déjà affectées.');
                return;
              }
              if (!mergeMode) {
                if (!selectedDeclaration) {
                  setError('Aucune déclaration sélectionnée.');
                  return;
                }
                if (assignedInStock.has(selectedDeclaration.id) || assignedIds.includes(selectedDeclaration.id)) {
                  setError('Cette déclaration est déjà affectée au stock.');
                  return;
                }
              }
              setLoading(true);
              try {
                if (mergeMode) {
                  await onAssignMerged({ ...selection, declarations: unassignedDeclarations });
                  await onCloseOrder();
                  closeAll();
                  return;
                }
                if (!selectedDeclaration) return;
                await onAssignDeclaration({ ...selection, declaration: selectedDeclaration });
                setAssignedIds((prev) => [...prev, selectedDeclaration.id]);
                setSelection(null);
                setSelectedDeclarationId(null);
                if (declarations.every((d) => assignedInStock.has(d.id) || d.id === selectedDeclaration.id || assignedIds.includes(d.id))) {
                  await onCloseOrder();
                  closeAll();
                }
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading
              ? 'En cours...'
              : mergeMode
                ? 'Fusionner, affecter et clôturer'
                : allAssigned
                  ? 'Clôturer et affecter'
                  : 'Affecter la déclaration'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
