'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DateFilterProps {
  value: string;
  onChange: (value: string) => void;
  onFilter: () => void;
  onReset: () => void;
}

export function DateFilter({ value, onChange, onFilter, onReset }: DateFilterProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label className="text-sm">Date</Label>
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-[180px]"
        />
      </div>
      <Button type="button" size="sm" onClick={onFilter}>
        Filtrer
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onReset}>
        Réinitialiser
      </Button>
    </div>
  );
}
