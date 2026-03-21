export interface TransfertFabrication {
  id: number;
  numComm: string;
  client: string;
  product: string;
  prodRef: string | null;
  qtyBox: number;
  unitPerbox: number | null;
  qtyUnit: number;
  totalQty: number | null;
  numPal: number;
  mouvement: string;
  statut: string;
  comment: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EditPermissions {
  canEditAll: boolean;
  canEditStatusOnly: boolean;
}

export interface CreateTransfertInput {
  numComm: string;
  client: string;
  product: string;
  prodRef?: string;
  qtyBox: number;
  unitPerbox?: number;
  qtyUnit: number;
  totalQty?: number;
  numPal: number;
  mouvement: string;
  statut: string;
  comment?: string;
}

export interface RapportFilters {
  dateFilter?: string;
  globalSearch?: string;
  movementFilters?: string[];
  statusFilters?: string[];
}

export interface ProcessedDataRow {
  Commande: string;
  Client: string;
  Produit: string;
  Mouvement: string;
  Changement: string;
  'Quantité Boîtes': number;
  'Unité/Boîte': number;
  'Quantité Unités': number;
  'Total Quantité': number;
  Date: string;
}

export interface ProcessedDataResponse {
  success: boolean;
  data: ProcessedDataRow[];
  totalGroups: number;
  originalRecords: number;
  dateFilter: string | null;
  dateRange: { minDate: string; maxDate: string } | null;
}

export interface SaleOrderOption {
  id: string;
  text: string;
  designation: string | null;
}

export interface ProductOption {
  id: string;
  text: string;
  refId: string;
}
