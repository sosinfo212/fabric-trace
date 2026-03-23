'use client';

import { useState } from 'react';
import { Modal } from '@/components/laboratoire/shared/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

function toDatetimeLocalValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function isTodayAndInAllowedHours(value: string, todayIsoDate: string): boolean {
  if (!value) return false;
  const [datePart, timePart = ''] = value.split('T');
  if (datePart !== todayIsoDate) return false;
  return timePart >= '08:00' && timePart <= '17:20';
}

export function DeclarationAddModal({
  open,
  onClose,
  produit,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  produit: string;
  onSubmit: (payload: {
    qty: number;
    lot: string;
    dateDebut?: string | null;
    dateFin?: string | null;
    commentaire?: string | null;
  }) => Promise<void>;
}) {
  const [qty, setQty] = useState(1);
  const [lot, setLot] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const now = new Date();
  const todayIsoDate = toDatetimeLocalValue(now).slice(0, 10);
  const minTodayTime = `${todayIsoDate}T08:00`;
  const maxTodayTime = `${todayIsoDate}T17:20`;

  return (
    <Modal open={open} onClose={onClose} title="Ajouter déclaration">
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setFormError(null);
          if (!isTodayAndInAllowedHours(dateDebut, todayIsoDate)) {
            setFormError('Date début doit être aujourd’hui avec une heure entre 08:00 et 17:20.');
            return;
          }
          if (!isTodayAndInAllowedHours(dateFin, todayIsoDate)) {
            setFormError('Date fin doit être aujourd’hui avec une heure entre 08:00 et 17:20.');
            return;
          }
          setLoading(true);
          try {
            await onSubmit({
              qty,
              lot,
              dateDebut: dateDebut || null,
              dateFin: dateFin || null,
              commentaire: commentaire.trim() || null,
            });
            onClose();
            setQty(1);
            setLot('');
            setDateDebut('');
            setDateFin('');
            setCommentaire('');
            setFormError(null);
          } finally {
            setLoading(false);
          }
        }}
      >
        <div className="space-y-2">
          <Label>Produit</Label>
          <Input value={produit} readOnly className="h-10 bg-muted font-medium" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="decl-qty">Quantité</Label>
            <Input
              id="decl-qty"
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="h-10"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="decl-lot">N° Lot</Label>
            <Input
              id="decl-lot"
              placeholder="Ex: LOT-2026-001"
              value={lot}
              onChange={(e) => setLot(e.target.value)}
              className="h-10 font-mono"
              required
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="decl-date-debut">Date début</Label>
            <Input
              id="decl-date-debut"
              type="datetime-local"
              value={dateDebut}
              min={minTodayTime}
              max={maxTodayTime}
              onChange={(e) => {
                setDateDebut(e.target.value);
                setFormError(null);
              }}
              className="h-10"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="decl-date-fin">Date fin</Label>
            <Input
              id="decl-date-fin"
              type="datetime-local"
              value={dateFin}
              min={minTodayTime}
              max={maxTodayTime}
              onChange={(e) => {
                setDateFin(e.target.value);
                setFormError(null);
              }}
              className="h-10"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="decl-commentaire">Commentaire</Label>
          <Textarea
            id="decl-commentaire"
            placeholder="Ajouter un commentaire..."
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            rows={4}
            className="resize-y"
          />
        </div>
        {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
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
