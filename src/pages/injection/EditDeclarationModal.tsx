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
import { injectionApi } from '@/lib/api';
import { Loader2 } from 'lucide-react';

const MOULE_OPTIONS = Array.from({ length: 45 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

function toDatetimeLocal(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

function toMinutes(dt: string): number {
  const d = new Date(dt);
  return d.getHours() * 60 + d.getMinutes();
}

function inRange(minutes: number): boolean {
  return minutes >= 480 && minutes <= 1045;
}

type DeclarationItem = Awaited<ReturnType<typeof injectionApi.getDeclaration>>;

interface EditDeclarationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  declaration: DeclarationItem;
  onSuccess: () => void;
}

export function EditDeclarationModal({ open, onOpenChange, declaration, onSuccess }: EditDeclarationModalProps) {
  const [loading, setLoading] = useState(false);
  const [designation, setDesignation] = useState(declaration.designation);
  const [quantite, setQuantite] = useState(String(declaration.quantite));
  const [machine, setMachine] = useState(declaration.machine);
  const [numMoule, setNumMoule] = useState(declaration.num_moule != null ? String(declaration.num_moule) : '');
  const [nbrEmpreinte, setNbrEmpreinte] = useState(declaration.nbr_empreinte != null ? String(declaration.nbr_empreinte) : '');
  const [dateDebut, setDateDebut] = useState(toDatetimeLocal(declaration.date_debut));
  const [dateFin, setDateFin] = useState(toDatetimeLocal(declaration.date_fin));
  const [effectif, setEffectif] = useState(String(declaration.effectif));
  const [commentaire, setCommentaire] = useState(declaration.commentaire ?? '');
  const [error, setError] = useState('');
  const [machineOptions, setMachineOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (open && declaration) {
      injectionApi.getMachines().then((list) => setMachineOptions((list || []).map((m) => ({ value: m, label: m }))));
      setDesignation(declaration.designation);
      setQuantite(String(declaration.quantite));
      setMachine(declaration.machine);
      setNumMoule(declaration.num_moule != null ? String(declaration.num_moule) : '');
      setNbrEmpreinte(declaration.nbr_empreinte != null ? String(declaration.nbr_empreinte) : '');
      setDateDebut(toDatetimeLocal(declaration.date_debut));
      setDateFin(toDatetimeLocal(declaration.date_fin));
      setEffectif(String(declaration.effectif));
      setCommentaire(declaration.commentaire ?? '');
      setError('');
    }
  }, [open, declaration]);

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
    if (!inRange(toMinutes(dateDebut))) {
      setError("L'heure de début doit être comprise entre 08:00 et 17:25.");
      return;
    }
    if (!inRange(toMinutes(dateFin))) {
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
    setLoading(true);
    try {
      await injectionApi.updateDeclaration(declaration.id, {
        of: declaration.of,
        designation: designation.trim(),
        quantite: qte,
        machine: machine.trim(),
        num_moule: numMoule === '' ? undefined : parseInt(numMoule, 10),
        nbr_empreinte: nbrEmpreinte === '' ? undefined : parseInt(nbrEmpreinte, 10),
        date_debut: dateDebut,
        date_fin: dateFin,
        effectif: eff,
        commentaire: commentaire.trim() || undefined,
      });
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier la déclaration</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Désignation <span className="text-destructive">*</span></Label>
            <Input value={designation} onChange={(e) => setDesignation(e.target.value)} className="h-9" required />
          </div>
          <div className="space-y-2">
            <Label>Quantité <span className="text-destructive">*</span></Label>
            <Input type="number" min={1} required value={quantite} onChange={(e) => setQuantite(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-2">
            <Label>Machine <span className="text-destructive">*</span></Label>
            <SearchableCombobox options={machineOptions} value={machine} onValueChange={setMachine} placeholder="Choisir une machine..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>N° Moule</Label>
              <SearchableCombobox options={MOULE_OPTIONS} value={numMoule} onValueChange={setNumMoule} placeholder="Optionnel" />
            </div>
            <div className="space-y-2">
              <Label>Nbr Empreinte</Label>
              <Input type="number" min={0} value={nbrEmpreinte} onChange={(e) => setNbrEmpreinte(e.target.value)} className="h-9" />
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
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
            />
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
