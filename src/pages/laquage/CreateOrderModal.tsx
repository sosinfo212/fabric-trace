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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { laquageApi } from '@/lib/api';
import { AutocompleteInput } from './components/AutocompleteInput';
import { Loader2 } from 'lucide-react';

const STATUS_OPTIONS = ['Planifié', 'En cours', 'Réalisé'] as const;

interface CreateOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateOrderModal({ open, onOpenChange, onSuccess }: CreateOrderModalProps) {
  const [loading, setLoading] = useState(false);
  const [nextOfid, setNextOfid] = useState<string>('');
  const [loadingOfid, setLoadingOfid] = useState(false);
  const [ordre, setOrdre] = useState<string>('');
  const [client, setClient] = useState('');
  const [commande, setCommande] = useState('');
  const [designation, setDesignation] = useState('');
  const [dateProduction, setDateProduction] = useState('');
  const [quantitePlanifie, setQuantitePlanifie] = useState<string>('');
  const [status, setStatus] = useState<string>('Planifié');

  useEffect(() => {
    if (open) {
      setLoadingOfid(true);
      laquageApi
        .getNextOfid()
        .then(setNextOfid)
        .finally(() => setLoadingOfid(false));
      setOrdre('');
      setClient('');
      setCommande('');
      setDesignation('');
      setDateProduction('');
      setQuantitePlanifie('');
      setStatus('Planifié');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ordreNum = ordre ? parseInt(ordre, 10) : null;
    const qte = parseInt(quantitePlanifie, 10);
    if (!nextOfid || !client.trim() || !commande.trim() || !designation.trim() || !dateProduction || !Number.isFinite(qte) || qte < 1) {
      return;
    }
    setLoading(true);
    try {
      await laquageApi.createOrder({
        ordre: ordreNum ?? undefined,
        client: client.trim(),
        commande: commande.trim(),
        ofid: nextOfid,
        designation: designation.trim(),
        dateProduction,
        quantitePlanifie: qte,
        status,
      });
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter un ordre de production</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="create-ordre">Ordre</Label>
            <Input
              id="create-ordre"
              type="number"
              min={1}
              value={ordre}
              onChange={(e) => setOrdre(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label>OFID (auto-généré)</Label>
            <Input
              value={loadingOfid ? '...' : nextOfid}
              readOnly
              className="h-9 bg-muted"
              placeholder="Généré automatiquement"
            />
          </div>
          <div className="col-span-2">
            <AutocompleteInput
              name="client"
              label="Client"
              value={client}
              onChange={setClient}
              required
              searchAction={laquageApi.searchClients}
              minChars={0}
              placeholder="Sélectionner un client ou rechercher"
            />
          </div>
          <div className="col-span-2">
            <AutocompleteInput
              name="commande"
              label="Commande"
              value={commande}
              onChange={setCommande}
              required
              searchAction={laquageApi.searchCommandes}
              minChars={0}
              placeholder="Sélectionner une commande ou rechercher"
            />
          </div>
          <div className="col-span-2">
            <AutocompleteInput
              name="designation"
              label="Désignation"
              value={designation}
              onChange={setDesignation}
              required
              searchAction={laquageApi.searchProducts}
              minChars={2}
              placeholder="Rechercher un produit"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-date">Date de production <span className="text-destructive">*</span></Label>
            <Input
              id="create-date"
              type="date"
              required
              value={dateProduction}
              onChange={(e) => setDateProduction(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-qte">Quantité planifiée <span className="text-destructive">*</span></Label>
            <Input
              id="create-qte"
              type="number"
              min={1}
              required
              value={quantitePlanifie}
              onChange={(e) => setQuantitePlanifie(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Statut</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="col-span-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading || !nextOfid || !client.trim() || !commande.trim() || !designation.trim() || !dateProduction || !quantitePlanifie}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
