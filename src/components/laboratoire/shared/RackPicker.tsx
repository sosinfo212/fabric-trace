'use client';

import type { LaboRack, LaboStockItem } from '@/lib/api';
import { cn } from '@/lib/utils';

export function RackPicker({
  racks,
  stockItems,
  selectedRackId,
  selectedStage,
  selectedPlace,
  currentStockId,
  allowOccupiedSelection,
  onSelect,
}: {
  racks: LaboRack[];
  stockItems: LaboStockItem[];
  selectedRackId?: number;
  selectedStage?: number;
  selectedPlace?: number;
  currentStockId?: number;
  allowOccupiedSelection?: boolean;
  onSelect: (rackId: number, stage: number, place: number, rackName: string) => void;
}) {
  const byKey = new Map(stockItems.map((s) => [`${s.rackId}-${s.stage}-${s.place}`, s]));

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {racks.map((rack) => (
        <div key={rack.id} className="min-w-[240px] rounded-lg border border-border bg-card p-3">
          <div className="mb-2 text-sm font-semibold">{rack.name}</div>
          <div className="space-y-2">
            {Array.from({ length: rack.stages }).map((_, si) => {
              const stage = si + 1;
              return (
                <div key={stage}>
                  <div className="mb-1 text-xs text-muted-foreground">Étape {stage}</div>
                  <div className="grid grid-cols-8 gap-1">
                    {Array.from({ length: rack.places }).map((__, pi) => {
                      const place = pi + 1;
                      const key = `${rack.id}-${stage}-${place}`;
                      const stock = byKey.get(key);
                      const isCurrent = currentStockId != null && stock?.id === currentStockId;
                      const isSelected =
                        selectedRackId === rack.id && selectedStage === stage && selectedPlace === place;
                      const occupied = !!stock && !isCurrent;
                      const clickable = !isCurrent && (!occupied || !!allowOccupiedSelection);
                      return (
                        <button
                          key={place}
                          type="button"
                          disabled={!clickable}
                          onClick={() => onSelect(rack.id, stage, place, rack.name)}
                          className={cn(
                            'h-7 rounded text-[11px] transition',
                            'border border-border bg-muted/50 text-muted-foreground',
                            clickable && 'hover:border-primary hover:bg-primary/10 hover:text-primary',
                            occupied &&
                              (allowOccupiedSelection
                                ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                : 'cursor-not-allowed border-destructive/50 bg-destructive/10 text-destructive'),
                            isCurrent && 'cursor-default border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300',
                            isSelected && 'border-primary bg-primary/15 text-primary ring-1 ring-primary'
                          )}
                        >
                          {place}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
