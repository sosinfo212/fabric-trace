'use client';

import { useState } from 'react';
import type { LaboRack } from '@/lib/api';
import { Modal } from '@/components/laboratoire/shared/Modal';
import { DotsMenu } from '@/components/laboratoire/shared/DotsMenu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2 } from 'lucide-react';

export function StructureModal({
  open,
  onClose,
  racks,
  onAdd,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  racks: LaboRack[];
  onAdd: (payload: { name: string; stages: number; places: number }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [stages, setStages] = useState(1);
  const [places, setPlaces] = useState(1);
  return (
    <Modal open={open} onClose={onClose} title="Structure des racks" size="lg">
      <form
        className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          await onAdd({ name, stages, places });
          setName('');
          setStages(1);
          setPlaces(1);
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="rack-name">Nom du rack</Label>
          <Input id="rack-name" placeholder="Nom du rack" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rack-stages">Étages</Label>
          <Input
            id="rack-stages"
            type="number"
            min={1}
            value={stages}
            onChange={(e) => setStages(Number(e.target.value))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rack-places">Places / étage</Label>
          <Input
            id="rack-places"
            type="number"
            min={1}
            value={places}
            onChange={(e) => setPlaces(Number(e.target.value))}
            required
          />
        </div>
        <Button type="submit" className="w-full md:w-auto">
          Ajouter
        </Button>
      </form>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {['Nom', 'Étages', 'Places/étage', 'Total places', 'Action'].map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {racks.map((rack) => (
                  <TableRow key={rack.id}>
                    <TableCell>{rack.name}</TableCell>
                    <TableCell>{rack.stages}</TableCell>
                    <TableCell>{rack.places}</TableCell>
                    <TableCell>{rack.stages * rack.places}</TableCell>
                    <TableCell>
                      <DotsMenu items={[{ label: 'Supprimer', icon: Trash2, danger: true, onClick: () => onDelete(rack.id) }]} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </Modal>
  );
}
