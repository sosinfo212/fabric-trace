'use client';

import { useState } from 'react';
import type { LaboRack, LaboStockItem } from '@/lib/api';
import { Modal } from '@/components/laboratoire/shared/Modal';
import { MoveProductModal } from './MoveProductModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function StageModal({
  open,
  onClose,
  rack,
  stage,
  rows,
  allRacks,
  allStock,
  onMove,
}: {
  open: boolean;
  onClose: () => void;
  rack: LaboRack | null;
  stage: number;
  rows: LaboStockItem[];
  allRacks: LaboRack[];
  allStock: LaboStockItem[];
  onMove: (payload: { stockId: number; rackId: number; stage: number; place: number }) => Promise<void>;
}) {
  const [moveItem, setMoveItem] = useState<LaboStockItem | null>(null);
  if (!rack) return null;
  return (
    <>
      <Modal open={open} onClose={onClose} title={`${rack.name} — Étape ${stage}`} size="lg">
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {['Place', 'Produit', 'Quantité', 'N° Lot', 'Action'].map((h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.place}</TableCell>
                      <TableCell>{row.produit}</TableCell>
                      <TableCell>{row.qty}</TableCell>
                      <TableCell className="font-mono text-sm">{row.lot}</TableCell>
                      <TableCell>
                        <Button type="button" variant="outline" size="sm" onClick={() => setMoveItem(row)}>
                          Déplacer
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </Modal>

      <MoveProductModal
        open={!!moveItem}
        onClose={() => setMoveItem(null)}
        stock={moveItem}
        racks={allRacks}
        stockItems={allStock}
        onConfirm={onMove}
      />
    </>
  );
}
