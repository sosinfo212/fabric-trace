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
import { injectionApi, type InjectionDeclarationRow } from '@/lib/api';
import { Loader2 } from 'lucide-react';

const MOULE_OPTIONS = Array.from({ length: 45 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

function toMinutes(dt: string): number {
  const d = new Date(dt);
  return d.getHours() * 60 + d.getMinutes();
}

function inRange(minutes: number): boolean {
  return minutes >= 480 && minutes <= 1045; // 08:00 - 17:25
}

interface DeclarationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: InjectionDeclarationRow;
  onSuccess: () => void;
}

export function DeclarationModal({ open, onOpenChange, row, onSuccess }: DeclarationModalProps) {
  const [loading, setLoading] = useState(false);
  const [quantite, setQuantite] = useState('');
  const [machine, setMachine] = useState('');
  const [numMoule, setNumMoule] = useState('');
  const [nbrEmpreinte, setNbrEmpreinte] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [effectif, setEffectif] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [error, setError] = useState('');
  const [machineOptions, setMachineOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (open) {
      injectionApi.getMachines().then((list) => setMachineOptions((list || []).map((m) => ({ value: m, label: m }))));
      setQuantite('');
      setMachine('');
      setNumMoule('');
      setNbrEmpreinte('');
      setCommentaire('');
      setEffectif('');
      setError('');
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const start = '08:00';
      const end = '09:00';
      setDateDebut(`${y}-${m}-${d}T${start}`);
      setDateFin(`${y}-${m}-${d}T${end}`);
    }
  }, [open, row]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const qte = parseInt(quantite, 10);
    if (!Number.isFinite(qte) || qte < 1) {
      setError('La quantité doit être supérieure à 0.');
      return;
    }
    if (!machine.trim()) {
      setError('La machine est requise.');
      return;
    }
    if (!dateDebut || !dateFin) {
      setError('Date début et date fin requises.');
      return;
    }
    const startM = toMinutes(dateDebut);
    const endM = toMinutes(dateFin);
    if (!inRange(startM)) {
      setError("L'heure de début doit être comprise entre 08:00 et 17:25.");
      return;
    }
    if (!inRange(endM)) {
      setError("L'heure de fin doit être comprise entre 08:00 et 17:25.");
      return;
    }
    if (new Date(dateFin) <= new Date(dateDebut)) {
      setError('La date de fin doit être postérieure à la date de début.');
      return;
    }
    const eff = parseInt(effectif, 10);
    if (!Number.isFinite(eff) || eff < 1) {
      setError("L'effectif est requis (min 1).");
      return;
    }
    const numM = numMoule === '' ? null : parseInt(numMoule, 10);
    const nbrE = nbrEmpreinte === '' ? null : parseInt(nbrEmpreinte, 10);
    setLoading(true);
    try {
      await injectionApi.createDeclaration({
        of: row.of,
        designation: row.designation,
        quantite: qte,
        machine: machine.trim(),
        num_moule: numM != null && Number.isFinite(numM) ? numM : undefined,
        nbr_empreinte: nbrE != null && Number.isFinite(nbrE) ? nbrE : undefined,
        date_debut: dateDebut,
        date_fin: dateFin,
        effectif: eff,
        commentaire: commentaire.trim() || undefined,
      });
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter une déclaration - OF: {row.of}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md bg-muted p-3 space-y-1 text-sm">
            <p><span className="font-medium">OF :</span> {row.of}</p>
            <p><span className="font-medium">Désignation :</span> {row.designation}</p>
          </div>
          <div className="space-y-2">
            <Label>Quantité <span className="text-destructive">*</span></Label>
            <Input type="number" min={1} required value={quantite} onChange={(e) => setQuantite(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-2">
            <Label>Machine <span className="text-destructive">*</span></Label>
            <SearchableCombobox options={machineOptions} value={machine} onValueChange={setMachine} placeholder="Choisir une machine..." searchPlaceholder="Rechercher..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>N° Moule</Label>
              <SearchableCombobox options={MOULE_OPTIONS} value={numMoule} onValueChange={setNumMoule} placeholder="Optionnel" />
            </div>
            <div className="space-y-2">
              <Label>Nbr Empreinte</Label>
              <Input type="number" min={0} placeholder="Ex: 8" value={nbrEmpreinte} onChange={(e) => setNbrEmpreinte(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Date début <span className="text-destructive">*</span></Label>
              <Input type="datetime-local" required value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-2">
              <Label>Date fin <span className="text-destructive">*</span></Label>
              <Input type="datetime-local" required value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="h-9" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Heures autorisées : 08:00 - 17:25</p>
          <div className="space-y-2">
            <Label>Effectif <span className="text-destructive">*</span></Label>
            <Input type="number" min={1} required value={effectif} onChange={(e) => setEffectif(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-2">
            <Label>Commentaire</Label>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={2}
              maxLength={1000}
              placeholder="Ajouter un commentaire (optionnel)"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{commentaire.length}/1000</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
