'use client';

import type { LaboDeclaration } from '@/lib/api';
import { Modal } from '@/components/laboratoire/shared/Modal';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  // Handle MySQL DATETIME (`YYYY-MM-DD HH:mm:ss`) consistently across browsers.
  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
  const dt = new Date(normalized);
  return Number.isNaN(dt.getTime())
    ? value
    : dt.toLocaleString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
}

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
                {['Produit', 'Quantité', 'N° Lot', 'Date début', 'Date fin', 'Commentaire', 'Date création'].map((h) => (
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
                  <TableCell>{formatDateTime(row.dateDebut)}</TableCell>
                  <TableCell>{formatDateTime(row.dateFin)}</TableCell>
                  <TableCell className="max-w-[260px] whitespace-pre-wrap break-words">{row.commentaire || '—'}</TableCell>
                  <TableCell>{formatDateTime(row.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Modal>
  );
}
