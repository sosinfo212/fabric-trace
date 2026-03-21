'use client';

import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { FabOrderOption } from '@/lib/api';

interface OFComboboxProps {
  options: FabOrderOption[];
  value: FabOrderOption | null;
  onSelect: (of: FabOrderOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function OFCombobox({
  options,
  value,
  onSelect,
  placeholder = 'Sélectionner un OF...',
  disabled = false,
  className,
}: OFComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const list = options.filter((o) => o && String(o.OFID ?? '').trim() !== '');
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (o) =>
        (o.OFID && o.OFID.toLowerCase().includes(q)) ||
        (o.saleOrderId && o.saleOrderId.toLowerCase().includes(q)) ||
        (o.prodName && o.prodName.toLowerCase().includes(q))
    );
  }, [options, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal min-w-0 text-left h-9', className)}
        >
          <span className="truncate">
            {value ? value.OFID : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0 max-h-[min(400px,70vh)] flex flex-col overflow-hidden" align="start">
        <Command shouldFilter={false} className="flex flex-col min-h-0 max-h-[min(400px,70vh)] overflow-hidden">
          <CommandInput
            placeholder="Rechercher par OF..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[280px] min-h-0 overflow-y-auto overflow-x-hidden">
            <CommandEmpty>Aucun OF trouvé.</CommandEmpty>
            <CommandGroup>
              {filtered.slice(0, 50).map((of) => (
                <CommandItem
                  key={of.OFID ?? of.saleOrderId ?? 'of'}
                  value={String(of.OFID ?? '')}
                  onSelect={() => {
                    onSelect(of);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value?.OFID === of.OFID ? 'opacity-100' : 'opacity-0')} />
                  <span className="font-medium">{of.OFID}</span>
                  {of.prodName && <span className="text-muted-foreground ml-2 truncate">— {of.prodName}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
