'use client';

import type { LaboRack, LaboStockItem } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function RackVisual({
  rack,
  stockItems,
  onOpenStage,
  highlightedPlaces = [],
}: {
  rack: LaboRack;
  stockItems: LaboStockItem[];
  onOpenStage: (rack: LaboRack, stage: number) => void;
  highlightedPlaces?: Array<{ rackId: number; stage: number; place: number }>;
}) {
  const byKey = new Map(stockItems.map((s) => [`${s.stage}-${s.place}`, s]));
  return (
    <Card className="w-[300px] shrink-0 border-white/[0.07] bg-[#162236] text-[#e8edf5]">
      <CardHeader className="pb-2">
        <CardTitle className="font-sans text-base text-[#e8edf5]">{rack.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {Array.from({ length: rack.stages }).map((_, si) => {
          const stage = si + 1;
          return (
            <div key={stage}>
              <Button
                type="button"
                variant="link"
                className="mb-1 h-auto p-0 text-xs text-[#8fa3bb] hover:text-[#e8edf5]"
                onClick={() => onOpenStage(rack, stage)}
              >
                Étape {stage}
              </Button>
              <div className="grid grid-cols-8 gap-1">
                {Array.from({ length: rack.places }).map((__, pi) => {
                  const place = pi + 1;
                  const stockItem = byKey.get(`${stage}-${place}`);
                  const occupied = !!stockItem;
                  const isHighlighted = highlightedPlaces.some(
                    (h) => h.rackId === rack.id && h.stage === stage && h.place === place
                  );
                  return (
                    <div
                      key={place}
                      data-rack={rack.id}
                      data-stage={stage}
                      data-place={place}
                      className={cn(
                        'h-7 rounded border text-center text-[11px] leading-7 transition-all duration-200',
                        isHighlighted
                          ? 'relative z-10 scale-110 border-[#00c9a7]/50 bg-[#00c9a7]/15 text-[#00c9a7] ring-2 ring-[#00c9a7] ring-offset-1 ring-offset-[#0f1929]'
                          : occupied
                            ? 'border-[#00c9a7]/30 bg-[#00c9a7]/10 text-[#00c9a7]'
                            : 'border-white/[0.07] bg-[#0f1929] text-[#4a6080]'
                      )}
                    >
                      {place}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
