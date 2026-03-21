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
import { laquageApi, type LaquageOrder } from '@/lib/api';
import { AutocompleteInput } from './components/AutocompleteInput';
import { Loader2 } from 'lucide-react';

const STATUS_OPTIONS = ['Planifié', 'En cours', 'Réalisé'] as const;

interface EditOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: LaquageOrder | null;
  onSuccess: () => void;
}

export function EditOrderModal({ open, onOpenChange, order, onSuccess }: EditOrderModalProps) {
  const [loading, setLoading] = useState(false);
  const [ordre, setOrdre] = useState<string>('');
  const [client, setClient] = useState('');
  const [commande, setCommande] = useState('');
  const [ofid, setOfid] = useState('');
  const [designation, setDesignation] = useState('');
  const [dateProduction, setDateProduction] = useState('');
  const [quantitePlanifie, setQuantitePlanifie] = useState<string>('');
  const [status, setStatus] = useState<string>('Planifié');

  useEffect(() => {
    if (order && open) {
      setOrdre(order.ordre != null ? String(order.ordre) : '');
      setClient(order.client);
      setCommande(order.commande);
      setOfid(order.OFID);
      setDesignation(order.designation);
      setDateProduction(order.date_production ? order.date_production.slice(0, 10) : '');
      setQuantitePlanifie(String(order.quantite_planifie));
      setStatus(order.status);
    }
  }, [order, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    const ordreNum = ordre ? parseInt(ordre, 10) : null;
    const qte = parseInt(quantitePlanifie, 10);
    if (!ofid.trim() || !client.trim() || !commande.trim() || !designation.trim() || !dateProduction || !Number.isFinite(qte) || qte < 1) {
      return;
    }
    setLoading(true);
    try {
      await laquageApi.updateOrder(order.id, {
        ordre: ordreNum ?? undefined,
        client: client.trim(),
        commande: commande.trim(),
        ofid: ofid.trim(),
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

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier l&apos;ordre de production</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-ordre">Ordre</Label>
            <Input
              id="edit-ordre"
              type="number"
              min={1}
              value={ordre}
              onChange={(e) => setOrdre(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-ofid">OFID</Label>
            <Input
              id="edit-ofid"
              value={ofid}
              onChange={(e) => setOfid(e.target.value)}
              className="h-9"
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
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-date">Date de production <span className="text-destructive">*</span></Label>
            <Input
              id="edit-date"
              type="date"
              required
              value={dateProduction}
              onChange={(e) => setDateProduction(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-qte">Quantité planifiée <span className="text-destructive">*</span></Label>
            <Input
              id="edit-qte"
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
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
