'use client';

import { useCallback, useState } from 'react';
import type { LaboRack, LaboStockItem } from '@/lib/api';
import { RackVisual } from '@/components/laboratoire/stock/RackVisual';
import { StockSearch } from '@/components/laboratoire/stock/StockSearch';
import { scrollToPlace } from '@/lib/laboratoire/scrollToPlace';

export interface StockViewClientProps {
  racks: LaboRack[];
  stockItems: LaboStockItem[];
  onOpenStage: (rack: LaboRack, stage: number) => void;
}

export function StockViewClient({ racks, stockItems, onOpenStage }: StockViewClientProps) {
  const [highlightedPlaces, setHighlightedPlaces] = useState<
    Array<{ rackId: number; stage: number; place: number }>
  >([]);

  const onHighlightsChange = useCallback((places: Array<{ rackId: number; stage: number; place: number }>) => {
    setHighlightedPlaces(places);
  }, []);

  const onRowSelect = useCallback((rackId: number, stage: number, place: number) => {
    setHighlightedPlaces([{ rackId, stage, place }]);
    requestAnimationFrame(() => scrollToPlace(rackId, stage, place));
  }, []);

  const hasRacks = racks.length > 0;

  return (
    <div className="space-y-6 rounded-xl border border-white/[0.07] bg-[#0f1929] p-4 md:p-6 font-sans text-[#e8edf5]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#e8edf5]">Visualisation des racks</h1>
          <p className="mt-1 text-sm text-[#8fa3bb]">Cliquez sur un étage pour voir les produits</p>
        </div>
        {hasRacks ? (
          <StockSearch
            allStock={stockItems}
            racks={racks}
            onHighlightsChange={onHighlightsChange}
            onRowSelect={onRowSelect}
          />
        ) : null}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {racks.map((rack) => (
          <RackVisual
            key={rack.id}
            rack={rack}
            stockItems={stockItems.filter((s) => s.rackId === rack.id)}
            highlightedPlaces={highlightedPlaces}
            onOpenStage={onOpenStage}
          />
        ))}
      </div>
    </div>
  );
}
