import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_PREFIX = 'fab-track:table-cols:';

export type TableColumnDef = {
  id: string;
  label: string;
  /** Always shown; omitted from the column picker */
  required?: boolean;
};

function buildMergedVisibility(
  columns: TableColumnDef[],
  storageKey: string
): Record<string, boolean> {
  const defaults: Record<string, boolean> = {};
  for (const c of columns) defaults[c.id] = true;

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    const out = { ...defaults };
    for (const c of columns) {
      if (c.required) out[c.id] = true;
      else if (typeof parsed[c.id] === 'boolean') out[c.id] = parsed[c.id];
    }
    return out;
  } catch {
    return defaults;
  }
}

/** Number of visible columns: leading cells (e.g. admin checkbox) + data columns. */
export function countVisibleTableColumns(
  columns: TableColumnDef[],
  visibility: Record<string, boolean>,
  leadingCount = 0
): number {
  let n = leadingCount;
  for (const c of columns) {
    if (c.required || visibility[c.id] !== false) n += 1;
  }
  return n;
}

export function useTableColumnVisibility(tableKey: string, columns: TableColumnDef[]) {
  const storageKey = `${STORAGE_PREFIX}${tableKey}`;
  const columnSignature = useMemo(() => columns.map((c) => c.id).join('|'), [columns]);
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  const [visibility, setVisibility] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(columns.map((c) => [c.id, true]))
  );

  useEffect(() => {
    setVisibility(buildMergedVisibility(columnsRef.current, storageKey));
  }, [storageKey, columnSignature]);

  useEffect(() => {
    const cols = columnsRef.current;
    try {
      const toStore: Record<string, boolean> = {};
      for (const c of cols) {
        if (!c.required) toStore[c.id] = visibility[c.id] !== false;
      }
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch {
      /* quota / private mode */
    }
  }, [storageKey, columnSignature, visibility]);

  const isVisible = useCallback(
    (id: string) => {
      const c = columns.find((x) => x.id === id);
      if (c?.required) return true;
      return visibility[id] !== false;
    },
    [columns, visibility]
  );

  const toggle = useCallback(
    (id: string) => {
      const c = columns.find((x) => x.id === id);
      if (c?.required) return;
      setVisibility((v) => ({ ...v, [id]: !v[id] }));
    },
    [columns]
  );

  const reset = useCallback(() => {
    const cols = columnsRef.current;
    const next = Object.fromEntries(cols.map((c) => [c.id, true]));
    setVisibility(next);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const optionalColumns = useMemo(() => columns.filter((c) => !c.required), [columns]);

  return { visibility, isVisible, toggle, reset, optionalColumns };
}
