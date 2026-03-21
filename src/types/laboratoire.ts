import type { LaboStockItem } from '@/lib/api';

/** Stock row with rack metadata (from GET /api/laboratoire/stock/full). */
export type StockSearchResult = LaboStockItem;
