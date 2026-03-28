import { Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type TableColumnPickerColumn = { id: string; label: string };

type TableColumnPickerProps = {
  optionalColumns: TableColumnPickerColumn[];
  visibility: Record<string, boolean>;
  onToggle: (id: string) => void;
  onReset: () => void;
  className?: string;
};

export function TableColumnPicker({
  optionalColumns,
  visibility,
  onToggle,
  onReset,
  className,
}: TableColumnPickerProps) {
  if (optionalColumns.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={cn('shrink-0', className)}>
          <Columns3 className="mr-2 h-4 w-4" />
          Colonnes
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="mb-3 text-sm font-medium">Colonnes visibles</p>
        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {optionalColumns.map((col) => (
            <div key={col.id} className="flex items-center gap-2">
              <Checkbox
                id={`col-${col.id}`}
                checked={visibility[col.id] !== false}
                onCheckedChange={() => onToggle(col.id)}
              />
              <Label htmlFor={`col-${col.id}`} className="cursor-pointer text-sm font-normal leading-none">
                {col.label}
              </Label>
            </div>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" className="mt-3 w-full" onClick={onReset}>
          Réinitialiser
        </Button>
      </PopoverContent>
    </Popover>
  );
}
