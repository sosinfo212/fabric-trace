import { useEffect, useMemo, useState } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { packingApi, type CreatePackingListInput, type PackingListWithRelations } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

type ItemRow = {
  localId: string;
  id?: number;
  pal_no: string;
  type_pal: '_' | 'ER';
  pal_kgs: number | null;
  designation: string;
  quantity: number;
  boxes: number;
  pieces: number;
  statut_pal?: string;
};

function computeQuantity(boxes: number, pieces: number) {
  return boxes > 0 ? boxes * pieces : pieces;
}

function SortableRow({
  item,
  index,
  onChange,
  onDelete,
  designationOptions,
  onDesignationQuery,
  onDesignationPick,
  showPalKgs,
}: {
  item: ItemRow;
  index: number;
  onChange: (localId: string, patch: Partial<ItemRow>) => void;
  onDelete: (localId: string) => void;
  designationOptions: string[];
  onDesignationQuery: (value: string) => void;
  onDesignationPick: (localId: string, value: string) => void;
  showPalKgs: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.localId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr ref={setNodeRef} style={style} className="bg-white">
      <td className="p-1.5 text-center">
        <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
      <td className="p-1.5">
        <Input value={item.pal_no} onChange={(e) => onChange(item.localId, { pal_no: e.target.value })} className="h-8" />
      </td>
      <td className="p-1.5">
        <Select value={item.type_pal} onValueChange={(v: '_' | 'ER') => onChange(item.localId, { type_pal: v })}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_">_</SelectItem>
            <SelectItem value="ER">ER</SelectItem>
          </SelectContent>
        </Select>
      </td>
      {showPalKgs ? (
        <td className="p-1.5">
          <Input
            type="number"
            step="0.01"
            value={item.pal_kgs ?? ''}
            onChange={(e) => onChange(item.localId, { pal_kgs: e.target.value === '' ? null : Number(e.target.value) })}
            className="h-8"
          />
        </td>
      ) : null}
      <td className="p-1.5">
        <Input
          value={item.designation}
          onChange={(e) => {
            onChange(item.localId, { designation: e.target.value });
            onDesignationQuery(e.target.value);
          }}
          onBlur={(e) => {
            if (!e.target.value.trim()) return;
            onDesignationPick(item.localId, e.target.value);
          }}
          list={`designation-list-${index}`}
          className="h-8 min-w-[280px]"
        />
        <datalist id={`designation-list-${index}`}>
          {designationOptions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </td>
      <td className="p-1.5">
        <Input type="number" value={item.quantity} readOnly className="h-8 bg-muted" />
      </td>
      <td className="p-1.5">
        <Input
          type="number"
          value={item.boxes}
          onChange={(e) => {
            const boxes = Number(e.target.value || 0);
            onChange(item.localId, { boxes, quantity: computeQuantity(boxes, item.pieces) });
          }}
          className="h-8"
        />
      </td>
      <td className="p-1.5">
        <Input
          type="number"
          value={item.pieces}
          onChange={(e) => {
            const pieces = Number(e.target.value || 0);
            onChange(item.localId, { pieces, quantity: computeQuantity(item.boxes, pieces) });
          }}
          className="h-8"
        />
      </td>
      <td className="p-1.5 text-center">
        <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => onDelete(item.localId)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}

export function PackingForm({
  initial,
  onSubmit,
  loading,
  showAdvancedFields = false,
}: {
  initial?: PackingListWithRelations | null;
  onSubmit: (payload: CreatePackingListInput) => Promise<void>;
  loading?: boolean;
  showAdvancedFields?: boolean;
}) {
  const [container, setContainer] = useState(initial?.container ?? '');
  const [client, setClient] = useState(initial?.client ?? '');
  const [proforma, setProforma] = useState(initial?.proforma ?? '');
  const [date, setDate] = useState((initial?.date ?? new Date().toISOString().slice(0, 10)).slice(0, 10));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [navalock, setNavalock] = useState(initial?.navalock ?? '');
  const [volume, setVolume] = useState(initial?.volume ?? '');
  const [generateCount, setGenerateCount] = useState(1);
  const [clientOptions, setClientOptions] = useState<string[]>([]);
  const [designationOptions, setDesignationOptions] = useState<string[]>([]);
  const [designationQuery, setDesignationQuery] = useState('');
  const [deletedItems, setDeletedItems] = useState<number[]>([]);
  const [items, setItems] = useState<ItemRow[]>(
    initial?.items?.length
      ? initial.items.map((it) => ({
          localId: `existing-${it.id}`,
          id: it.id,
          pal_no: it.palNo,
          type_pal: (it.typePal as '_' | 'ER') || '_',
          pal_kgs: it.palKgs,
          designation: it.designation,
          quantity: it.quantity,
          boxes: it.boxes,
          pieces: it.pieces,
          statut_pal: it.statutPal,
        }))
      : [],
  );

  useEffect(() => {
    let active = true;
    packingApi.searchProducts('').then((data) => {
      if (!active) return;
      setDesignationOptions(data);
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (client.trim().length < 2) {
      setClientOptions([]);
      return;
    }
    const t = setTimeout(() => {
      packingApi.searchDesignations(client.trim()).then(setClientOptions).catch(() => undefined);
    }, 300);
    return () => clearTimeout(t);
  }, [client]);

  useEffect(() => {
    if (designationQuery.trim().length < 3) return;
    const t = setTimeout(() => {
      packingApi.searchProducts(designationQuery.trim()).then((remote) => {
        setDesignationOptions((prev) => Array.from(new Set([...remote, ...prev])));
      }).catch(() => undefined);
    }, 300);
    return () => clearTimeout(t);
  }, [designationQuery]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const filteredDesignationOptions = useMemo(() => {
    const q = designationQuery.toLowerCase().trim();
    if (!q) return designationOptions.slice(0, 100);
    return designationOptions.filter((item) => item.toLowerCase().includes(q)).slice(0, 100);
  }, [designationOptions, designationQuery]);

  const updateRow = (localId: string, patch: Partial<ItemRow>) => {
    setItems((prev) => prev.map((it) => (it.localId === localId ? { ...it, ...patch } : it)));
  };

  const addRows = (count: number, options?: { palNo?: string; pieces?: number }) => {
    const nextRows = Array.from({ length: count }).map((_, i) => {
      const pieces = options?.pieces ?? 48;
      return {
        localId: `new-${Date.now()}-${i}`,
        pal_no: options?.palNo ?? '',
        type_pal: '_' as const,
        pal_kgs: null,
        designation: '',
        quantity: pieces,
        boxes: 0,
        pieces,
      };
    });
    setItems((prev) => [...prev, ...nextRows]);
  };

  const removeRow = (localId: string) => {
    setItems((prev) => {
      const found = prev.find((it) => it.localId === localId);
      if (found?.id) setDeletedItems((ids) => [...ids, found.id!]);
      return prev.filter((it) => it.localId !== localId);
    });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((r) => r.localId === active.id);
      const newIndex = prev.findIndex((r) => r.localId === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const applyDesignation = async (localId: string, value: string) => {
    const designation = value.trim();
    if (!designation) return;
    updateRow(localId, { designation });
    try {
      const containedQuantity = await packingApi.getContainedQuantity(designation);
      if (containedQuantity > 0) {
        setItems((prev) =>
          prev.map((it) =>
            it.localId === localId
              ? {
                  ...it,
                  designation,
                  pieces: containedQuantity,
                  quantity: computeQuantity(it.boxes, containedQuantity),
                }
              : it,
          ),
        );
      }
    } catch {
      // Keep manual pieces value if lookup fails.
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!container.trim() || !client.trim() || !proforma.trim() || !date) {
      toast({ title: 'Champs obligatoires', description: 'Container, client, proforma et date sont requis.', variant: 'destructive' });
      return;
    }
    if (!items.length) {
      toast({ title: 'Lignes requises', description: 'Ajoutez au moins une ligne.', variant: 'destructive' });
      return;
    }
    if (items.some((it) => !it.pal_no.trim() || !it.designation.trim())) {
      toast({ title: 'Lignes invalides', description: 'PAL N° et désignation sont obligatoires.', variant: 'destructive' });
      return;
    }

    await onSubmit({
      container: container.trim(),
      client: client.trim(),
      proforma: proforma.trim(),
      date,
      notes: notes || null,
      navalock: navalock || null,
      volume: volume || null,
      deleted_items: deletedItems,
      items: items.map((it, idx) => ({
        id: it.id,
        pal_no: it.pal_no.trim(),
        type_pal: it.type_pal,
        pal_kgs: it.pal_kgs,
        statut_pal: it.statut_pal || '_',
        designation: it.designation.trim(),
        quantity: computeQuantity(it.boxes, it.pieces),
        boxes: it.boxes,
        pieces: it.pieces,
        order: idx,
      })),
    });
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="space-y-1">
          <Label>Container</Label>
          <Input value={container} onChange={(e) => setContainer(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Client</Label>
          <Input list="client-designations" value={client} onChange={(e) => setClient(e.target.value)} />
          <datalist id="client-designations">
            {clientOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1">
          <Label>Proforma N°</Label>
          <Input value={proforma} onChange={(e) => setProforma(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {showAdvancedFields ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label>Navalock</Label>
            <Input value={navalock} onChange={(e) => setNavalock(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Volume</Label>
            <Input value={volume} onChange={(e) => setVolume(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label>Nombre de lignes à remplir</Label>
          <Input className="w-36" type="number" min={1} value={generateCount} onChange={(e) => setGenerateCount(Number(e.target.value || 1))} />
        </div>
        <Button type="button" variant="secondary" onClick={() => addRows(Math.max(1, generateCount))}>
          Générer
        </Button>
        <Button type="button" onClick={() => addRows(1)}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter ligne
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#b4b0b0] text-[10px] font-extrabold uppercase text-[#212529]">
              <th className="p-2 text-center">#</th>
              <th className="p-2 text-center">PAL N°</th>
              <th className="p-2 text-center">Type Pal</th>
              {showAdvancedFields ? <th className="p-2 text-center">Pal Kgs</th> : null}
              <th className="p-2 text-center">Désignation</th>
              <th className="p-2 text-center">Quantity</th>
              <th className="p-2 text-center">Boxes</th>
              <th className="p-2 text-center">Pièces</th>
              <th className="p-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map((it) => it.localId)} strategy={verticalListSortingStrategy}>
                {items.map((item, index) => (
                  <SortableRow
                    key={item.localId}
                    item={item}
                    index={index}
                    onChange={updateRow}
                    onDelete={removeRow}
                    designationOptions={filteredDesignationOptions}
                    onDesignationQuery={setDesignationQuery}
                    onDesignationPick={applyDesignation}
                    showPalKgs={showAdvancedFields}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {!items.length ? (
              <tr>
                <td colSpan={showAdvancedFields ? 9 : 8} className="p-5 text-center text-muted-foreground">
                  Aucune ligne.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  );
}
