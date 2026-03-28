'use client';

import { Pencil, Trash2 } from 'lucide-react';
import type { LaboOrdre } from '@/lib/api';
import { StatusBadge } from '@/components/laboratoire/shared/StatusBadge';
import { DotsMenu } from '@/components/laboratoire/shared/DotsMenu';
import { Card, CardContent } from '@/components/ui/card';
import { TableColumnPicker } from '@/components/ui/table-column-picker';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTableColumnVisibility, countVisibleTableColumns, type TableColumnDef } from '@/hooks/use-table-column-visibility';

const ORDRES_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'id', label: '#ID' },
  { id: 'produit', label: 'Produit' },
  { id: 'qty', label: 'Quantité' },
  { id: 'instruction', label: 'Instruction' },
  { id: 'statut', label: 'Statut' },
  { id: 'action', label: 'Action', required: true },
];

export function OrdresTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: LaboOrdre[];
  onEdit: (row: LaboOrdre) => void;
  onDelete: (row: LaboOrdre) => void;
}) {
  const { isVisible, toggle, reset, optionalColumns, visibility } = useTableColumnVisibility(
    'labo-ordres',
    ORDRES_TABLE_COLUMNS
  );
  const colSpan = countVisibleTableColumns(ORDRES_TABLE_COLUMNS, visibility, 0);

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex justify-end border-b px-4 py-2">
          <TableColumnPicker
            optionalColumns={optionalColumns}
            visibility={visibility}
            onToggle={toggle}
            onReset={reset}
          />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {isVisible('id') && <TableHead>#ID</TableHead>}
                {isVisible('produit') && <TableHead>Produit</TableHead>}
                {isVisible('qty') && <TableHead>Quantité</TableHead>}
                {isVisible('instruction') && <TableHead>Instruction</TableHead>}
                {isVisible('statut') && <TableHead>Statut</TableHead>}
                {isVisible('action') && <TableHead>Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={Math.max(colSpan, 1)} className="text-center text-muted-foreground">
                    Aucune ligne
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    {isVisible('id') && <TableCell className="font-medium">{row.id}</TableCell>}
                    {isVisible('produit') && <TableCell>{row.produit}</TableCell>}
                    {isVisible('qty') && <TableCell>{row.qty}</TableCell>}
                    {isVisible('instruction') && (
                      <TableCell className="text-muted-foreground">{row.instruction || '—'}</TableCell>
                    )}
                    {isVisible('statut') && (
                      <TableCell>
                        <StatusBadge statut={row.statut} />
                      </TableCell>
                    )}
                    {isVisible('action') && (
                      <TableCell>
                        <DotsMenu
                          items={[
                            { label: 'Modifier', icon: Pencil, onClick: () => onEdit(row) },
                            { label: 'Supprimer', icon: Trash2, danger: true, onClick: () => onDelete(row) },
                          ]}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
