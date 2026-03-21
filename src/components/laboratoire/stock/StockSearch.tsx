'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { PackageOpen, Search, X } from 'lucide-react';
import type { LaboRack } from '@/lib/api';
import type { StockSearchResult } from '@/types/laboratoire';
import { cn } from '@/lib/utils';

export interface StockSearchProps {
  allStock: StockSearchResult[];
  racks: LaboRack[];
  onHighlightsChange: (places: Array<{ rackId: number; stage: number; place: number }>) => void;
  onRowSelect: (rackId: number, stage: number, place: number) => void;
}

function highlightTextSafe(text: string, q: string): ReactNode {
  const needle = q.trim();
  if (!needle) return text;
  const lower = text.toLowerCase();
  const n = needle.toLowerCase();
  const out: ReactNode[] = [];
  let start = 0;
  let idx = lower.indexOf(n, start);
  let key = 0;
  while (idx !== -1) {
    if (idx > start) out.push(<span key={`t${key++}`}>{text.slice(start, idx)}</span>);
    out.push(
      <mark key={`m${key++}`} className="rounded bg-[#00c9a7]/20 px-[2px] text-[#00c9a7]">
        {text.slice(idx, idx + needle.length)}
      </mark>
    );
    start = idx + needle.length;
    idx = lower.indexOf(n, start);
  }
  if (start < text.length) out.push(<span key={`t${key++}`}>{text.slice(start)}</span>);
  return out.length ? out : text;
}

export function StockSearch({ allStock, racks, onHighlightsChange, onRowSelect }: StockSearchProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 150);
    return () => window.clearTimeout(t);
  }, [query]);

  const q = debouncedQuery.toLowerCase().trim();

  const matches =
    !q
      ? []
      : allStock.filter(
          (s) =>
            s.produit.toLowerCase().includes(q) ||
            String(s.lot ?? '')
              .toLowerCase()
              .includes(q)
        );

  useEffect(() => {
    if (!q) {
      onHighlightsChange([]);
      return;
    }
    onHighlightsChange(
      allStock
        .filter(
          (s) =>
            s.produit.toLowerCase().includes(q) ||
            String(s.lot ?? '')
              .toLowerCase()
              .includes(q)
        )
        .map((m) => ({ rackId: m.rackId, stage: m.stage, place: m.place }))
    );
  }, [q, allStock, onHighlightsChange]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const rackLabel = useCallback(
    (rackId: number) => racks.find((r) => r.id === rackId)?.name ?? 'Rack',
    [racks]
  );

  const clear = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setOpen(false);
    setFocusedIdx(-1);
    onHighlightsChange([]);
  }, [onHighlightsChange]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setOpen(false);
      setFocusedIdx(-1);
      return;
    }
    setOpen(true);
    setFocusedIdx(-1);
  }, [debouncedQuery]);

  const showPanel = open && debouncedQuery.trim().length > 0;

  const onKeyDownInput = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      clear();
      return;
    }
    if (!showPanel || !matches.length) {
      if (e.key === 'ArrowDown' && query.trim()) {
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIdx((i) => Math.min(matches.length - 1, i < 0 ? 0 : i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(0, i <= 0 ? 0 : i - 1));
      return;
    }
    if (e.key === 'Enter' && focusedIdx >= 0 && focusedIdx < matches.length) {
      e.preventDefault();
      const m = matches[focusedIdx];
      onRowSelect(m.rackId, m.stage, m.place);
      setOpen(false);
    }
  };

  const onKeyDownList = (e: KeyboardEvent) => {
    if (!matches.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIdx((i) => Math.min(matches.length - 1, i < 0 ? 0 : i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(0, i <= 0 ? 0 : i - 1));
    } else if (e.key === 'Enter' && focusedIdx >= 0 && focusedIdx < matches.length) {
      e.preventDefault();
      const m = matches[focusedIdx];
      onRowSelect(m.rackId, m.stage, m.place);
      setOpen(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      clear();
    }
  };

  return (
    <div ref={rootRef} className="relative min-w-[300px] max-w-md flex-1">
      <div className="relative flex items-center">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4a6080]"
          aria-hidden
        />
        <input
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="Rechercher un produit"
          placeholder="Rechercher produit ou lot…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim()) setOpen(true);
          }}
          onKeyDown={onKeyDownInput}
          className="w-full rounded-lg border border-white/[0.12] bg-[#162236] py-2 pl-9 pr-8 text-sm text-[#e8edf5] outline-none transition-colors placeholder:text-[#4a6080] focus:border-[#00c9a7]"
        />
        {query ? (
          <button
            type="button"
            aria-label="Effacer la recherche"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#4a6080] transition-colors hover:text-[#e8edf5]"
            onClick={clear}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          tabIndex={-1}
          onKeyDown={onKeyDownList}
          className="absolute right-0 z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-white/[0.12] bg-[#162236] shadow-xl"
        >
          <div className="px-4 pb-1 pt-3 text-[11px] text-[#4a6080]">
            {matches.length} résultat{matches.length > 1 ? 's' : ''} trouvé{matches.length > 1 ? 's' : ''}
          </div>
          {matches.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-[#4a6080]">
              <PackageOpen className="h-8 w-8 opacity-50" aria-hidden />
              <p>Aucun produit trouvé pour «{debouncedQuery.trim()}»</p>
            </div>
          ) : (
            <ul className="pb-2">
              {matches.map((row, idx) => {
                const label = row.rackName ?? rackLabel(row.rackId);
                const loc = `${label} — S${row.stage} — P${row.place}`;
                return (
                  <li key={`${row.id}-${row.rackId}-${row.stage}-${row.place}`} role="presentation">
                    <div
                      role="option"
                      aria-selected={focusedIdx === idx}
                      tabIndex={0}
                      className={cn(
                        'flex w-full flex-col gap-1 border-t border-white/[0.07] px-4 py-3 text-left transition-colors',
                        focusedIdx === idx ? 'bg-[#1e3050]' : 'hover:bg-[#1e3050]/60'
                      )}
                      onClick={() => {
                        onRowSelect(row.rackId, row.stage, row.place);
                        setOpen(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          onRowSelect(row.rackId, row.stage, row.place);
                          setOpen(false);
                        }
                      }}
                      onMouseEnter={() => setFocusedIdx(idx)}
                    >
                      <div className="flex items-start gap-2">
                        <span className="flex-shrink-0 rounded-md border border-white/[0.07] bg-[#0f1929] px-2 py-1 font-mono text-[11px] text-[#00c9a7]">
                          {loc}
                        </span>
                        <span className="text-[13.5px] font-semibold leading-snug text-[#e8edf5]">
                          {highlightTextSafe(row.produit, debouncedQuery)}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-[#8fa3bb]">
                        Lot:{' '}
                        <span className="font-mono">{highlightTextSafe(String(row.lot ?? ''), debouncedQuery)}</span>
                        {' · '}
                        Qté: {row.qty}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
