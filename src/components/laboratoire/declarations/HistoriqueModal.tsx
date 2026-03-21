'use client';

import type { LaboDeclaration } from '@/lib/api';
import { Modal } from '@/components/laboratoire/shared/Modal';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function HistoriqueModal({
  open,
  onClose,
  rows,
}: {
  open: boolean;
  onClose: () => void;
  rows: LaboDeclaration[];
}) {
  return (
    <Modal open={open} onClose={onClose} title="Historique des déclarations" size="lg">
      <Card>
        <CardContent className="max-h-[60vh] overflow-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {['Produit', 'Quantité', 'N° Lot', 'Date'].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.produit}</TableCell>
                  <TableCell>{row.qty}</TableCell>
                  <TableCell className="font-mono text-sm">{row.lot}</TableCell>
                  <TableCell>{new Date(row.createdAt).toLocaleString('fr-FR')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Modal>
  );
}
