import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface AutocompleteInputProps {
  name: string;
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  searchAction: (term: string) => Promise<string[]>;
  minChars?: number;
  placeholder?: string;
  className?: string;
}

const DEBOUNCE_MS = 300;

export function AutocompleteInput({
  name,
  label,
  value = '',
  onChange,
  required,
  searchAction,
  minChars = 2,
  placeholder,
  className,
}: AutocompleteInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const fetchSuggestions = useCallback(
    async (term: string) => {
      if (minChars > 0 && term.length < minChars) {
        setSuggestions([]);
        return;
      }
      setLoading(true);
      try {
        const list = await searchAction(term);
        setSuggestions(list);
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [searchAction, minChars]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    onChange?.(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), DEBOUNCE_MS);
  };

  const handleFocus = () => {
    if (minChars === 0 && !inputValue) fetchSuggestions('');
    else if (inputValue.length >= minChars) fetchSuggestions(inputValue);
  };

  const handleSelect = (item: string) => {
    setInputValue(item);
    onChange?.(item);
    setSuggestions([]);
    setOpen(false);
  };

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn('space-y-1.5', className)}>
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        id={name}
        name={name}
        value={inputValue}
        onChange={handleChange}
        onFocus={handleFocus}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        className="h-9"
      />
      {open && (suggestions.length > 0 || loading) && (
        <ul className="border border-border rounded-md bg-popover shadow-md py-1 max-h-48 overflow-auto z-50">
          {loading ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Chargement...</li>
          ) : (
            suggestions.map((item) => (
              <li
                key={item}
                role="option"
                className="px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(item);
                }}
              >
                {item}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
