'use client';

import { Pencil, Trash2 } from 'lucide-react';
import type { LaboOrdre } from '@/lib/api';
import { StatusBadge } from '@/components/laboratoire/shared/StatusBadge';
import { DotsMenu } from '@/components/laboratoire/shared/DotsMenu';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function OrdresTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: LaboOrdre[];
  onEdit: (row: LaboOrdre) => void;
  onDelete: (row: LaboOrdre) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {['#ID', 'Produit', 'Quantité', 'Instruction', 'Statut', 'Action'].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.id}</TableCell>
                  <TableCell>{row.produit}</TableCell>
                  <TableCell>{row.qty}</TableCell>
                  <TableCell className="text-muted-foreground">{row.instruction || '—'}</TableCell>
                  <TableCell>
                    <StatusBadge statut={row.statut} />
                  </TableCell>
                  <TableCell>
                    <DotsMenu
                      items={[
                        { label: 'Modifier', icon: Pencil, onClick: () => onEdit(row) },
                        { label: 'Supprimer', icon: Trash2, danger: true, onClick: () => onDelete(row) },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
