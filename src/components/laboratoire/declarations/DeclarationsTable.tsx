'use client';

import { CheckCircle2, Clock3, History, Plus } from 'lucide-react';
import type { LaboOrdreWithDeclarations } from '@/lib/api';
import { DotsMenu } from '@/components/laboratoire/shared/DotsMenu';
import { StatusBadge } from '@/components/laboratoire/shared/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function DeclarationsTable({
  rows,
  onAdd,
  onHistory,
  onCloseFlow,
}: {
  rows: LaboOrdreWithDeclarations[];
  onAdd: (row: LaboOrdreWithDeclarations) => void;
  onHistory: (row: LaboOrdreWithDeclarations) => void;
  onCloseFlow: (row: LaboOrdreWithDeclarations) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {['#ID', 'Produit', 'Quantité', 'Instruction', 'N° Lot', 'Statut', 'Action'].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const last = row.declarations[0];
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.id}</TableCell>
                    <TableCell>{row.produit}</TableCell>
                    <TableCell>{row.qty}</TableCell>
                    <TableCell className="text-muted-foreground">{row.instruction || '—'}</TableCell>
                    <TableCell className="font-mono text-sm">{last?.lot || '—'}</TableCell>
                    <TableCell>
                      <StatusBadge statut={row.statut} />
                    </TableCell>
                    <TableCell>
                      <DotsMenu
                        items={[
                          { label: 'Ajouter', icon: Plus, onClick: () => onAdd(row) },
                          { label: 'Historique', icon: History, onClick: () => onHistory(row) },
                          ...(row.statut !== 'Cloture'
                            ? [{ label: 'Clôturer', icon: CheckCircle2, onClick: () => onCloseFlow(row) }]
                            : [{ label: 'Déjà clôturé', icon: Clock3, onClick: () => {} }]),
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
