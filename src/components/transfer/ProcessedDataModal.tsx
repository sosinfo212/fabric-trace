import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { MouvementBadge } from './MouvementBadge';
import type { ProcessedDataResponse } from '@/types/transfert';

interface ProcessedDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ProcessedDataResponse;
}

export function ProcessedDataModal({ open, onOpenChange, data }: ProcessedDataModalProps) {
  const ratio =
    data.originalRecords > 0
      ? Math.round((1 - data.totalGroups / data.originalRecords) * 100)
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Données groupées</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-auto">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Enregistrements originaux</p>
                <p className="text-2xl font-bold">{data.originalRecords}</p>
                <p className="text-sm text-muted-foreground">Groupes créés : {data.totalGroups}</p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Compression</p>
                <p className="text-2xl font-bold text-green-700">{ratio}%</p>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Filtre</p>
                <p className="font-medium">{data.dateFilter || 'Toutes les dates'}</p>
                {data.dateRange && (
                  <p className="text-sm text-muted-foreground">
                    Plage : {data.dateRange.minDate} — {data.dateRange.maxDate}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Commande</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>Mouvement</TableHead>
                  <TableHead>Changement</TableHead>
                  <TableHead className="text-center">Quantité Boîtes</TableHead>
                  <TableHead className="text-center">Unité/Boîte</TableHead>
                  <TableHead className="text-center">Quantité Unités</TableHead>
                  <TableHead className="text-center font-bold">Total Quantité</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>{row.Commande}</TableCell>
                    <TableCell>{row.Client}</TableCell>
                    <TableCell>{row.Produit}</TableCell>
                    <TableCell>
                      <MouvementBadge mouvement={row.Mouvement} variant="rapport" />
                    </TableCell>
                    <TableCell>{row.Changement || '-'}</TableCell>
                    <TableCell className="text-center">{row['Quantité Boîtes']}</TableCell>
                    <TableCell className="text-center">{row['Unité/Boîte']}</TableCell>
                    <TableCell className="text-center">{row['Quantité Unités']}</TableCell>
                    <TableCell className="text-center font-bold">{row['Total Quantité']}</TableCell>
                    <TableCell className="text-xs">{row.Date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
