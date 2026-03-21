'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
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
import { componentChangesApi, type ComponentAutocompleteResult } from '@/lib/api';

const DEBOUNCE_MS = 300;

interface ComponentComboboxProps {
  type: 'original' | 'new';
  ofId: string;
  nomDuProduit?: string;
  value: string; // component_code
  onChange: (code: string) => void;
  excludeCode?: string; // for type='new', exclude original component
  displayLabel?: string; // optional label when value set (e.g. edit mode before options load)
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ComponentCombobox({
  type,
  ofId,
  nomDuProduit,
  value,
  onChange,
  excludeCode,
  displayLabel,
  placeholder = 'Sélectionner un composant...',
  disabled = false,
  className,
}: ComponentComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<ComponentAutocompleteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<ComponentAutocompleteResult | null>(null);

  const fetchOptions = useCallback(
    async (q: string) => {
      if (type === 'original' && !nomDuProduit) {
        setOptions([]);
        return;
      }
      setLoading(true);
      try {
        if (type === 'new') {
          const { data } = await componentChangesApi.listAllComponents(q || undefined);
          setOptions(data || []);
        } else {
          const { data } = await componentChangesApi.autocompleteComponents({
            q: q || undefined,
            of_id: ofId || undefined,
            type: 'original',
            nom_du_produit: nomDuProduit,
          });
          setOptions(data || []);
        }
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [type, ofId, nomDuProduit]
  );

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => fetchOptions(search), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [open, search, fetchOptions]);

  useEffect(() => {
    if (open && (type === 'new' || nomDuProduit)) {
      fetchOptions(search);
    } else if (!open) {
      setOptions([]);
    }
  }, [open, type, nomDuProduit]);

  useEffect(() => {
    if (value && selectedOption?.componentCode !== value) {
      setSelectedOption(null);
    }
  }, [value, selectedOption?.componentCode]);

  const displayOptions = excludeCode
    ? options.filter((o) => o.componentCode !== excludeCode)
    : options;

  const selectedLabel =
    displayLabel ??
    selectedOption?.componentName ??
    options.find((o) => o.componentCode === value)?.componentName ??
    (value || null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal min-w-0 text-left h-9', className)}
          title={selectedLabel || undefined}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          {loading ? <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin" /> : <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0 max-h-[min(400px,70vh)] flex flex-col overflow-hidden" align="start">
        <Command shouldFilter={false} className="flex flex-col min-h-0 max-h-[min(400px,70vh)] overflow-hidden">
          <CommandInput
            placeholder="Rechercher..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[280px] min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain flex-1">
            {loading && options.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Chargement...</div>
            ) : (
              <>
                <CommandEmpty>Aucun composant trouvé.</CommandEmpty>
                <CommandGroup>
                  {displayOptions.map((opt) => (
                    <CommandItem
                      key={opt.componentCode}
                      value={opt.componentCode}
                      onSelect={() => {
                        setSelectedOption(opt);
                        onChange(opt.componentCode);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', value === opt.componentCode ? 'opacity-100' : 'opacity-0')} />
                      {opt.componentName}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
