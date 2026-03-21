// API Client to replace Supabase client
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Get auth token from localStorage
const getToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

// Set auth token in localStorage
export const setAuthToken = (token: string): void => {
  localStorage.setItem('auth_token', token);
};

// Remove auth token from localStorage
export const removeAuthToken = (): void => {
  localStorage.removeItem('auth_token');
};

// API request helper
const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const { method = 'GET', body, ...rest } = options;
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...rest,
    method,
    body,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Une erreur est survenue' }));
    const msg = error.message || error.error || `HTTP error! status: ${response.status}`;
    const err = new Error(msg) as Error & { errors?: Record<string, string[]> };
    if (error.errors) err.errors = error.errors;
    throw err;
  }

  return response.json();
};

// Auth API
export const authApi = {
  signUp: async (email: string, password: string, fullName?: string) => {
    const data = await apiRequest<{ user: any; token: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name: fullName }),
    });
    setAuthToken(data.token);
    return { user: data.user, error: null };
  },

  signIn: async (email: string, password: string) => {
    const data = await apiRequest<{ user: any; token: string }>('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(data.token);
    return { user: data.user, error: null };
  },

  verify: async () => {
    return apiRequest<{ user: any }>('/auth/verify');
  },

  signOut: async () => {
    removeAuthToken();
  },
};

// User Role API
export const userRoleApi = {
  getRole: async () => {
    return apiRequest<{ role: string | null }>('/user/role');
  },

  /** Allowed menu paths for current user's role (from Administration → Permissions). */
  getPermissions: async () => {
    return apiRequest<{ menu_paths: string[] }>('/user/permissions');
  },
};

// Users API
export const usersApi = {
  getAll: async () => {
    return apiRequest<any[]>('/users');
  },

  create: async (userData: { email: string; password: string; full_name?: string; role: string }) => {
    return apiRequest<{ success: boolean; userId: string }>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  updateRole: async (userId: string, role: string) => {
    return apiRequest<{ success: boolean }>(`/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },

  update: async (
    userId: string,
    data: { email?: string; full_name?: string; password?: string; role?: string }
  ) => {
    return apiRequest<{ success: boolean }>(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (userId: string) => {
    return apiRequest<{ success: boolean }>(`/users/${userId}`, {
      method: 'DELETE',
    });
  },
};

// Transfert Fabrication API
export const transfertApi = {
  getToday: () =>
    apiRequest<{ data: import('@/types/transfert').TransfertFabrication[] }>('/transfert-fabrication/today'),
  statusCheck: () =>
    apiRequest<{ data: { id: number; statut: string }[] }>('/transfert-fabrication/status-check'),
  getSaleOrders: (search?: string) =>
    apiRequest<{ data: { id: string; text: string; designation: string | null }[] }>(
      `/transfert-fabrication/sale-orders${search != null && search !== '' ? `?search=${encodeURIComponent(search)}` : ''}`
    ),
  getProducts: (search?: string) =>
    apiRequest<{ data: { id: string; text: string; refId: string }[] }>(
      `/transfert-fabrication/products${search != null && search !== '' ? `?search=${encodeURIComponent(search)}` : ''}`
    ),
  create: (data: import('@/types/transfert').CreateTransfertInput) =>
    apiRequest<{ data: import('@/types/transfert').TransfertFabrication }>('/transfert-fabrication', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getById: (id: number) =>
    apiRequest<import('@/types/transfert').TransfertFabrication>(`/transfert-fabrication/${id}`),
  update: (id: number, data: Partial<import('@/types/transfert').TransfertFabrication> & { statut?: string }) =>
    apiRequest<import('@/types/transfert').TransfertFabrication>(`/transfert-fabrication/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    apiRequest<{ success: boolean }>(`/transfert-fabrication/${id}`, { method: 'DELETE' }),
  validate: (id: number) =>
    apiRequest<{ success: boolean; data: { id: number; statut: string } }>(`/transfert-fabrication/${id}/validate`, {
      method: 'PUT',
    }),
  getAll: () =>
    apiRequest<{ data: import('@/types/transfert').TransfertFabrication[] }>('/transfert-fabrication/list'),
  processExcel: (filters: import('@/types/transfert').RapportFilters) =>
    apiRequest<import('@/types/transfert').ProcessedDataResponse>('/transfert-fabrication/process-excel', {
      method: 'POST',
      body: JSON.stringify(filters),
    }),
  exportExcel: async (filters: { dateFilter?: string; globalSearch?: string; movementFilters?: string[]; statusFilters?: string[] }) => {
    const params = new URLSearchParams();
    if (filters.dateFilter) params.set('dateFilter', filters.dateFilter);
    if (filters.globalSearch) params.set('globalSearch', filters.globalSearch);
    if (filters.movementFilters?.length) params.set('movementFilters', filters.movementFilters.join(','));
    if (filters.statusFilters?.length) params.set('statusFilters', filters.statusFilters.join(','));
    const token = getToken();
    const res = await fetch(
      `${API_URL}/transfert-fabrication/export-excel?${params.toString()}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport_fabrication_grouped_${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

// Clients API
export const clientsApi = {
  getAll: async () => {
    return apiRequest<any[]>('/clients');
  },

  create: async (clientData: { name: string; designation?: string; instruction?: string; instruction_logistique?: string }) => {
    return apiRequest<{ success: boolean; id: string }>('/clients', {
      method: 'POST',
      body: JSON.stringify(clientData),
    });
  },

  update: async (id: string, clientData: { name: string; designation?: string; instruction?: string; instruction_logistique?: string }) => {
    return apiRequest<{ success: boolean }>(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(clientData),
    });
  },

  delete: async (id: string) => {
    return apiRequest<{ success: boolean }>(`/clients/${id}`, {
      method: 'DELETE',
    });
  },
};

// Commandes API
export const commandesApi = {
  getAll: async () => {
    return apiRequest<any[]>('/commandes');
  },

  create: async (commandeData: { num_commande: string; client_id: string; date_planifiee?: string; date_debut?: string; date_fin?: string; instruction?: string }) => {
    return apiRequest<{ success: boolean; id: string }>('/commandes', {
      method: 'POST',
      body: JSON.stringify(commandeData),
    });
  },

  update: async (id: string, commandeData: { num_commande: string; client_id: string; date_planifiee?: string; date_debut?: string; date_fin?: string; instruction?: string }) => {
    return apiRequest<{ success: boolean }>(`/commandes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(commandeData),
    });
  },

  delete: async (id: string) => {
    return apiRequest<{ success: boolean }>(`/commandes/${id}`, {
      method: 'DELETE',
    });
  },
};

// Planning report (Rapport Commande) – one row per sale order
export interface PlanningReportRow {
  sale_order_id: string;
  client_name: string | null;
  pf_qty: number;
  sf_qty: number;
  set_qty: number;
  tester_qty: number;
  fabrication_Pf_Qty: number;
  fabrication_Sf_Qty: number;
  fabrication_Set_qty: number;
  fabrication_Tester_qty: number;
  statut: string;
}

export const planningReportApi = {
  getReport: async () => {
    return apiRequest<PlanningReportRow[]>('/planning/report');
  },
};

// Sérigraphie planning (ordres de pré-fabrication)
export interface SerigraphieOrderRow {
  id: string;
  OFID: string;
  prod_ref: string | null;
  prod_des: string | null;
  client: string | null;
  commande: string | null;
  date_planifie: string | null;
  qte_plan: number;
  qte_reel: number;
  statut: string;
  instruction: string | null;
  comment: string | null;
  Priority?: number;
  qty_produced?: number | null;
}

export interface SerigraphieDropdowns {
  clients: string[];
  products: { ref_id: string; product_name: string }[];
  commandes: string[];
}

export interface SerigraphieImportRow {
  client?: string;
  commande?: string;
  OFID: string;
  prod_ref?: string;
  prod_des?: string;
  date_planifie?: string;
  qte_plan?: number;
  instruction?: string;
  comment?: string;
}

export const serigraphieOrdersApi = {
  getList: async () => {
    const res = await apiRequest<{ data: SerigraphieOrderRow[] }>('/serigraphie/orders');
    return res.data;
  },
  getDropdowns: async () => {
    return apiRequest<SerigraphieDropdowns>('/serigraphie/orders/dropdowns');
  },
  getOne: async (id: string) => {
    return apiRequest<SerigraphieOrderRow>(`/serigraphie/orders/${id}`);
  },
  store: async (data: {
    id?: string;
    OFID: string;
    prod_ref?: string | null;
    prod_des?: string | null;
    client?: string | null;
    commande?: string | null;
    qte_plan: number;
    qte_reel?: number;
    statut: string;
    date_planifie: string;
    instruction?: string | null;
    comment?: string | null;
    priority?: number;
  }) => {
    return apiRequest<{ message: string }>('/serigraphie/orders/store', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        priority: data.priority ?? 0,
      }),
    });
  },
  delete: async (id: string) => {
    return apiRequest<{ message: string }>(`/serigraphie/orders/${id}`, { method: 'DELETE' });
  },
  import: async (rows: SerigraphieImportRow[]) => {
    return apiRequest<{ message: string; inserted: number; errors?: string[] }>('/serigraphie/orders/import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },
};

// Déclaration Sérigraphie (index list, declarations by OFID, create, update, delete, rebuts, components, defauts)
export interface SerigraphieDeclarationRow {
  OFID: string;
  commande: string | null;
  client: string | null;
  prod_des: string | null;
  qte_plan: number;
  qte_reel: number;
  statut: string;
  qte_fab: number;
  planning_id?: string;
}

export interface SerigraphieDeclarationDetail {
  id: number;
  OFID: string;
  commande: string | null;
  product: string | null;
  client: string | null;
  date_debut: string | null;
  date_fin: string | null;
  qte_fab: number;
  mat_quality: number;
  mat_prod: number;
  comment: string | null;
}

export interface SerigraphieRebutRow {
  id: number;
  OFID: string;
  date_declaration: string;
  quantite: number;
  commentaire: string | null;
  composant_id: string | null;
  defaut_id: string | null;
  composant_name: string | null;
  composant_code: string | null;
  defaut_label: string | null;
}

export interface SerigraphieComponent {
  id: string;
  component_name: string | null;
  component_code: string | null;
}

export interface SerigraphieDefaut {
  id: string;
  label: string | null;
}

export const serigraphieDeclarationApi = {
  getList: async () => {
    const res = await apiRequest<{ data: SerigraphieDeclarationRow[] }>('/serigraphie/declaration-list');
    return res.data;
  },
  getByOfid: async (ofid: string) => {
    return apiRequest<SerigraphieDeclarationDetail[]>(`/serigraphie/declarations-by-ofid/${encodeURIComponent(ofid)}`);
  },
  create: async (data: {
    OFID: string;
    date_debut?: string | null;
    date_fin?: string | null;
    qte_fab: number;
    Mat_prod: number;
    Mat_quality: number;
    Comment?: string | null;
    statut?: string;
    qty_nc?: Array<{ component?: string; component_name?: string; qty_nc?: number; default?: string; comment?: string }>;
  }) => apiRequest<{ success: boolean; id: number; message: string }>('/serigraphie/declaration', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: async (id: number, data: Partial<{ date_debut: string; date_fin: string; qte_fab: number; Comment: string; mat_quality: number; mat_prod: number }>) =>
    apiRequest<{ success: boolean }>(`/serigraphie/declaration/${id}`, { method: 'PATCH', body: JSON.stringify(data ?? {}) }),
  delete: async (id: number) =>
    apiRequest<{ success: boolean }>(`/serigraphie/declaration/${id}`, { method: 'DELETE' }),
  getCreateForm: async (encodedOFID: string) =>
    apiRequest<{ planning: Record<string, unknown>; components: SerigraphieComponent[] }>(`/serigraphie/declaration/create-form/${encodedOFID}`),
};

export const serigraphieRebutApi = {
  getComponents: async (productName: string) =>
    apiRequest<SerigraphieComponent[]>(`/serigraphie/components?product_name=${encodeURIComponent(productName)}`),
  getDefauts: async () => apiRequest<SerigraphieDefaut[]>('/serigraphie/defauts'),
  store: async (data: { OFID: string; date_declaration: string; quantite: number; composant_id?: string | null; defaut_id?: string | null; commentaire?: string | null }) =>
    apiRequest<{ success: boolean; message: string }>('/serigraphie/rebut', { method: 'POST', body: JSON.stringify(data) }),
  getByOfid: async (encodedOFID: string) =>
    apiRequest<SerigraphieRebutRow[]>(`/serigraphie/rebuts/${encodedOFID}`),
  delete: async (id: number) =>
    apiRequest<{ success: boolean }>(`/serigraphie/rebut/${id}`, { method: 'DELETE' }),
};

// Laquage (perfume bottle coating) API
/** Order row from API (snake_case from DB + quantiteFabriqueeTotal, tauxRealisation) */
export interface LaquageOrder {
  id: number;
  ordre: number | null;
  client: string;
  commande: string;
  OFID: string;
  designation: string;
  date_production: string | null;
  quantite_planifie: number;
  status: string;
  created_at: string;
  updated_at: string;
  quantiteFabriqueeTotal: number;
  tauxRealisation: number;
}

/** Declaration list row from API (snake_case) */
export interface LaquageDeclarationRow {
  laquage_id: number;
  client: string;
  commande: string;
  OFID: string;
  designation: string;
  quantite_planifie: number;
  status: string;
  created_at: string;
  total_fabriquee: number;
  commentaire: string | null;
}

export interface LaquageDeclarationHistoryItem {
  id: number;
  laquage_id: number;
  quantite_fabriquee: number;
  day: string | null;
  heure_debut: string | null;
  heure_fin: string | null;
  commentaire: string | null;
  created_at: string;
}

/** Rebut list row: one per OFID with totalRebut */
export interface LaquageRebutOrderRow {
  id: number;
  OFID: string;
  client: string;
  commande: string;
  quantite_planifie: number;
  created_at: string;
  totalRebut: number;
}

export interface LaquageRebutHistoryItem {
  id: number;
  OFID: string;
  date_declaration: string;
  quantite: number;
  composant: string;
  defaut: string;
  commentaire: string | null;
  created_at: string;
}

export const laquageApi = {
  getOrders: async () => apiRequest<{ data: LaquageOrder[] }>('/laquage/orders').then((r) => r.data),
  getNextOfid: async () => apiRequest<{ ofid: string }>('/laquage/next-ofid').then((r) => r.ofid),
  createOrder: async (data: { ordre?: number | null; client: string; commande: string; ofid: string; designation: string; dateProduction: string; quantitePlanifie: number; status?: string }) =>
    apiRequest<{ success: boolean }>('/laquage/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateOrder: async (id: number, data: { ordre?: number | null; client: string; commande: string; ofid: string; designation: string; dateProduction: string; quantitePlanifie: number; status?: string }) =>
    apiRequest<{ success: boolean }>(`/laquage/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateOrdre: async (id: number, ordre: number | null) =>
    apiRequest<{ success: boolean }>(`/laquage/orders/${id}/ordre`, { method: 'PATCH', body: JSON.stringify({ ordre }) }),
  deleteOrder: async (id: number) =>
    apiRequest<{ success: boolean }>(`/laquage/orders/${id}`, { method: 'DELETE' }),
  searchClients: async (q: string) => apiRequest<string[]>(`/laquage/search/clients?q=${encodeURIComponent(q)}`),
  searchProducts: async (q: string) => apiRequest<string[]>(`/laquage/search/products?q=${encodeURIComponent(q)}`),
  searchCommandes: async (q?: string) => apiRequest<string[]>(`/laquage/search/commandes${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getDeclarations: async () => apiRequest<{ data: LaquageDeclarationRow[] }>('/laquage/declarations').then((r) => r.data),
  getDeclarationHistory: async (laquageId: number) =>
    apiRequest<LaquageDeclarationHistoryItem[]>(`/laquage/declarations/history/${laquageId}`),
  createDeclaration: async (data: { laquageId: number; quantiteFabriquee: number; day: string; heureDebut: string; heureFin: string; commentaire?: string | null }) =>
    apiRequest<{ success: boolean }>('/laquage/declarations', { method: 'POST', body: JSON.stringify(data) }),
  updateDeclaration: async (id: number, data: { quantiteFabriquee: number; day: string; heureDebut: string; heureFin: string; commentaire?: string | null }) =>
    apiRequest<{ success: boolean }>(`/laquage/declarations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDeclaration: async (id: number) =>
    apiRequest<{ success: boolean }>(`/laquage/declarations/${id}`, { method: 'DELETE' }),
  getRebuts: async () => apiRequest<{ data: LaquageRebutOrderRow[] }>('/laquage/rebuts').then((r) => r.data),
  getRebutHistory: async (ofid: string) =>
    apiRequest<LaquageRebutHistoryItem[]>(`/laquage/rebuts/history/${encodeURIComponent(ofid)}`),
  createRebut: async (data: { ofid: string; dateDeclaration?: string; quantite: number; composant: string; defaut: string; commentaire?: string | null }) =>
    apiRequest<{ success: boolean }>('/laquage/rebuts', { method: 'POST', body: JSON.stringify(data) }),
  updateRebut: async (id: number, data: { quantite: number; composant: string; defaut: string; commentaire?: string | null }) =>
    apiRequest<{ success: boolean }>(`/laquage/rebuts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRebut: async (id: number) =>
    apiRequest<{ success: boolean }>(`/laquage/rebuts/${id}`, { method: 'DELETE' }),
};

// Injection module (perfume bottle injection workshop)
export interface InjectionOrder {
  of: string;
  designation: string;
  quantite: number;
  date_planification: string;
  user_name: string | null;
  created_at: string;
  updated_at: string;
  total_fabriquee: number;
  taux_realisation: number;
  status: string;
}

export interface InjectionDeclarationRow {
  of: string;
  designation: string;
  quantite: number;
  total_fabriquee: number;
  status: string;
}

export interface InjectionDeclarationHistoryItem {
  id: number;
  of: string;
  designation: string;
  quantite: number;
  machine: string;
  num_moule: number | null;
  nbr_empreinte: number | null;
  date_debut: string;
  date_fin: string;
  effectif: number;
  username: string | null;
  commentaire: string | null;
  created_at: string;
}

export interface InjectionRebutOrderRow {
  of: string;
  designation: string;
  quantite: number;
  totalRebut: number;
  conformity: number;
}

export interface InjectionRebutHistoryItem {
  id: number;
  of: string;
  composant: string;
  defaut: string;
  cause: string;
  quantite: number;
  username: string | null;
  created_at: string;
}

export const injectionApi = {
  getOrders: async () => apiRequest<{ data: InjectionOrder[] }>('/injection/orders').then((r) => r.data),
  getNextOf: async () => apiRequest<{ of: string }>('/injection/next-of').then((r) => r.of),
  getOrder: async (of: string) => apiRequest<InjectionOrder>(`/injection/orders/${encodeURIComponent(of)}`),
  createOrder: async (data: { of: string; designation: string; quantite: number; date_planification: string }) =>
    apiRequest<{ success: boolean }>('/injection/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateOrder: async (of: string, data: { designation: string; quantite: number; date_planification: string }) =>
    apiRequest<{ success: boolean }>(`/injection/orders/${encodeURIComponent(of)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteOrder: async (of: string) =>
    apiRequest<{ success: boolean }>(`/injection/orders/${encodeURIComponent(of)}`, { method: 'DELETE' }),
  getDesignations: async () => apiRequest<string[]>('/injection/designations'),
  getDeclarations: async () => apiRequest<{ data: InjectionDeclarationRow[] }>('/injection/declarations').then((r) => r.data),
  getDeclarationHistory: async (of: string) =>
    apiRequest<InjectionDeclarationHistoryItem[]>(`/injection/declarations/history/${encodeURIComponent(of)}`),
  createDeclaration: async (data: {
    of: string;
    designation: string;
    quantite: number;
    machine: string;
    num_moule?: number | null;
    nbr_empreinte?: number | null;
    date_debut: string;
    date_fin: string;
    effectif: number;
    commentaire?: string | null;
  }) => apiRequest<{ success: boolean }>('/injection/declarations', { method: 'POST', body: JSON.stringify(data) }),
  getDeclaration: async (id: number) => apiRequest<InjectionDeclarationHistoryItem & { of: string }>(`/injection/declarations/${id}`),
  updateDeclaration: async (id: number, data: {
    of: string;
    designation: string;
    quantite: number;
    machine: string;
    num_moule?: number | null;
    nbr_empreinte?: number | null;
    date_debut: string;
    date_fin: string;
    effectif: number;
    commentaire?: string | null;
  }) => apiRequest<{ success: boolean }>(`/injection/declarations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDeclaration: async (id: number) =>
    apiRequest<{ success: boolean }>(`/injection/declarations/${id}`, { method: 'DELETE' }),
  getMachines: async () => apiRequest<string[]>('/injection/machines'),
  getRebuts: async () => apiRequest<{ data: InjectionRebutOrderRow[] }>('/injection/rebuts').then((r) => r.data),
  getRebutHistory: async (of: string) =>
    apiRequest<InjectionRebutHistoryItem[]>(`/injection/rebuts/history/${encodeURIComponent(of)}`),
  createRebuts: async (data: { of: string; composant: string; rebuts: Array<{ defaut: string; cause: string; quantite: number }> }) =>
    apiRequest<{ success: boolean; count: number }>('/injection/rebuts', { method: 'POST', body: JSON.stringify(data) }),
  getRebut: async (id: number) => apiRequest<InjectionRebutHistoryItem>(`/injection/rebuts/${id}`),
  updateRebut: async (id: number, data: { defaut: string; cause: string; quantite: number }) =>
    apiRequest<{ success: boolean }>(`/injection/rebuts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRebut: async (id: number) =>
    apiRequest<{ success: boolean }>(`/injection/rebuts/${id}`, { method: 'DELETE' }),
  getRebutOptions: async () =>
    apiRequest<{ defauts: string[]; causes: string[] }>('/injection/rebut-options'),
};

// Products API
export const productsApi = {
  getAll: async () => {
    return apiRequest<any[]>('/products');
  },

  getPaginated: async (page: number = 1, limit: number = 50, search: string = '') => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (search && search.trim()) {
      params.append('search', search.trim());
    }
    const url = `/products?${params.toString()}`;
    console.log('API Request URL:', url);
    try {
      return await apiRequest<{ data: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(url);
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  },

  create: async (productData: { ref_id: string; product_name: string; image_url?: string }) => {
    return apiRequest<{ success: boolean; id: string }>('/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  },

  update: async (id: string, productData: { ref_id: string; product_name: string; image_url?: string }) => {
    return apiRequest<{ success: boolean }>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
  },

  delete: async (id: string) => {
    return apiRequest<{ success: boolean }>(`/products/${id}`, {
      method: 'DELETE',
    });
  },
};

export interface PackingListItem {
  id: number;
  packingListId: number;
  palNo: string;
  typePal: string;
  palKgs: number | null;
  status: string;
  statutPal: string;
  designation: string;
  quantity: number;
  boxes: number;
  pieces: number;
  order: number;
  batchNbr: string | null;
  manufacturingDate: string | null;
  expiryDate: string | null;
}

export interface WeightSet {
  id: number;
  idPackingList: number;
  item: string;
  qty: number;
  totalWeight: number;
  unitValue: number;
  totalValue: number;
}

export interface PackingListWithRelations {
  id: number;
  container: string;
  client: string;
  proforma: string;
  date: string;
  status: string;
  notes: string | null;
  navalock: string | null;
  volume: string | null;
  createdAt: string;
  updatedAt: string;
  items: PackingListItem[];
  weightSets: WeightSet[];
  clientModel?: {
    designation: string;
    instruction: string | null;
    instruction_logistique: string | null;
  } | null;
}

export interface CreatePackingListInput {
  container: string;
  client: string;
  proforma: string;
  date: string;
  notes?: string | null;
  navalock?: string | null;
  volume?: string | null;
  items: Array<{
    id?: number;
    pal_no: string;
    type_pal?: string;
    pal_kgs?: number | null;
    statut_pal?: string;
    designation: string;
    quantity?: number;
    boxes?: number;
    pieces?: number;
    order?: number;
  }>;
  deleted_items?: number[];
}

export const packingApi = {
  getAll: async () => apiRequest<{ success: boolean; data: any[] }>('/shipping/packing').then((r) => r.data),
  getOne: async (id: number) =>
    apiRequest<{ success: boolean; data: PackingListWithRelations }>(`/shipping/packing/${id}`).then((r) => r.data),
  create: async (payload: CreatePackingListInput) =>
    apiRequest<{ success: boolean; message: string; data?: { id: number } }>('/shipping/packing', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: async (id: number, payload: CreatePackingListInput) =>
    apiRequest<{ success: boolean; message: string }>(`/shipping/packing/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  remove: async (id: number) =>
    apiRequest<{ success: boolean; message: string }>(`/shipping/packing/${id}`, { method: 'DELETE' }),
  duplicate: async (id: number) =>
    apiRequest<{ success: boolean; message: string; duplicatedId?: number }>(`/shipping/packing/${id}/duplicate`, {
      method: 'POST',
    }),
  getItemsForProduction: async (id: number) =>
    apiRequest<{
      success: boolean;
      data: {
        proforma: string;
        items: Array<{
          id: number;
          designation: string;
          batch_nbr: string;
          manufacturing_date: string | null;
          expiry_date: string | null;
        }>;
      };
    }>(`/shipping/packing/${id}/items`).then((r) => r.data),
  updateProductionData: async (
    id: number,
    items: Array<{
      id: number;
      batch_nbr: string | null;
      manufacturing_date: string | null;
      expiry_date: string | null;
    }>,
  ) =>
    apiRequest<{ success: boolean; message: string }>(`/shipping/packing/${id}/production-data`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),
  searchProducts: async (q: string) =>
    apiRequest<{ success: boolean; data: string[] }>(`/shipping/packing/search-products?q=${encodeURIComponent(q)}`).then((r) => r.data),
  searchDesignations: async (q: string) =>
    apiRequest<{ success: boolean; data: string[] }>(`/shipping/packing/designations?q=${encodeURIComponent(q)}`).then((r) => r.data),
  getContainedQuantity: async (name: string) =>
    apiRequest<{ success: boolean; data: { containedQuantity: number } }>(
      `/box-quantities/contained?name=${encodeURIComponent(name)}`,
    ).then((r) => r.data.containedQuantity),
  getWeightSetItemData: async () =>
    apiRequest<{ success: boolean; data: Record<string, { weight: number; price: number }> }>(
      '/shipping/packing/weight-set/item-data',
    ).then((r) => r.data),
  storeWeightSets: async (id: number, weight_sets: Array<{ Item: string; Qty: number }>) =>
    apiRequest<{ success: boolean; message: string }>(`/shipping/packing/${id}/weight-set`, {
      method: 'POST',
      body: JSON.stringify({ weight_sets }),
    }),
  clearWeightSets: async (id: number) =>
    apiRequest<{ success: boolean; message: string }>(`/shipping/packing/${id}/weight-set`, { method: 'DELETE' }),
  deleteWeightSet: async (id: number, wsId: number) =>
    apiRequest<{ success: boolean; message: string }>(`/shipping/packing/${id}/weight-set/${wsId}`, {
      method: 'DELETE',
    }),
};

// Product Components API
export const productComponentsApi = {
  getByProduct: async (productId: string) => {
    return apiRequest<any[]>(`/products/${productId}/components`);
  },

  create: async (productId: string, componentData: { component_name: string; component_code?: string; quantity: number }) => {
    return apiRequest<{ success: boolean; id: string }>(`/products/${productId}/components`, {
      method: 'POST',
      body: JSON.stringify(componentData),
    });
  },

  update: async (id: string, componentData: { component_name: string; component_code?: string; quantity: number }) => {
    return apiRequest<{ success: boolean }>(`/components/${id}`, {
      method: 'PUT',
      body: JSON.stringify(componentData),
    });
  },

  delete: async (id: string) => {
    return apiRequest<{ success: boolean }>(`/components/${id}`, {
      method: 'DELETE',
    });
  },

  importFromCSV: async (rows: Array<{ ref_id: string; component_name: string; component_code?: string; quantity: string | number }>) => {
    return apiRequest<{
      success: boolean;
      summary: { total: number; imported: number; errors: number; skipped: number };
      details: {
        success: Array<{ line: number; ref_id: string; component_name: string; product_id: string }>;
        errors: Array<{ line: number; ref_id: string; error: string }>;
        skipped: Array<{ line: number; ref_id: string; component_name: string; error: string }>;
      };
    }>('/products/components/import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },
};

// Chains API
export const chainsApi = {
  getAll: async () => {
    return apiRequest<any[]>('/chains');
  },

  create: async (chainData: { num_chaine: number; chef_de_chaine_id?: string; responsable_qlty_id?: string; nbr_operateur?: number }) => {
    return apiRequest<{ success: boolean; id: string }>('/chains', {
      method: 'POST',
      body: JSON.stringify(chainData),
    });
  },

  update: async (id: string, chainData: { num_chaine: number; chef_de_chaine_id?: string; responsable_qlty_id?: string; nbr_operateur?: number }) => {
    return apiRequest<{ success: boolean }>(`/chains/${id}`, {
      method: 'PUT',
      body: JSON.stringify(chainData),
    });
  },

  delete: async (id: string) => {
    return apiRequest<{ success: boolean }>(`/chains/${id}`, {
      method: 'DELETE',
    });
  },
};

// Defects API
export const defectsApi = {
  getCategories: async () => {
    return apiRequest<any[]>('/defects/categories');
  },

  getAll: async () => {
    return apiRequest<any[]>('/defects');
  },

  createCategory: async (categoryData: { category_name: string; description?: string }) => {
    return apiRequest<{ success: boolean; id: string }>('/defects/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData),
    });
  },

  create: async (defectData: { label: string; category_id: string; description?: string }) => {
    return apiRequest<{ success: boolean; id: string }>('/defects', {
      method: 'POST',
      body: JSON.stringify(defectData),
    });
  },

  updateCategory: async (id: string, categoryData: { category_name: string; description?: string }) => {
    return apiRequest<{ success: boolean }>(`/defects/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(categoryData),
    });
  },

  update: async (id: string, defectData: { label: string; category_id: string; description?: string }) => {
    return apiRequest<{ success: boolean }>(`/defects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(defectData),
    });
  },

  deleteCategory: async (id: string) => {
    return apiRequest<{ success: boolean }>(`/defects/categories/${id}`, {
      method: 'DELETE',
    });
  },

  delete: async (id: string) => {
    return apiRequest<{ success: boolean }>(`/defects/${id}`, {
      method: 'DELETE',
    });
  },
};

// Roles API
export const rolesApi = {
  getAll: async () => {
    return apiRequest<any[]>('/roles');
  },

  create: async (roleData: { name: string; label: string; description?: string }) => {
    return apiRequest<{ success: boolean; id: string }>('/roles', {
      method: 'POST',
      body: JSON.stringify(roleData),
    });
  },

  update: async (id: string, roleData: { label: string; description?: string }) => {
    return apiRequest<{ success: boolean }>(`/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(roleData),
    });
  },

  delete: async (id: string) => {
    return apiRequest<{ success: boolean }>(`/roles/${id}`, {
      method: 'DELETE',
    });
  },
};

// Permissions API
export const permissionsApi = {
  getAll: async () => {
    return apiRequest<any[]>('/permissions');
  },

  create: async (permissionData: { role: string; menu_path: string; can_access: boolean }) => {
    return apiRequest<{ success: boolean; id: string }>('/permissions', {
      method: 'POST',
      body: JSON.stringify(permissionData),
    });
  },

  update: async (id: string, permissionData: { can_access: boolean }) => {
    return apiRequest<{ success: boolean }>(`/permissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(permissionData),
    });
  },

  updateBulk: async (role: string, permissions: { menu_path: string; can_access: boolean }[]) => {
    return apiRequest<{ success: boolean }>(`/permissions/role/${role}`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    });
  },
};

// Profiles API
export const profilesApi = {
  getAll: async () => {
    return apiRequest<any[]>('/profiles');
  },
};

// User Roles API
export const userRolesApi = {
  getAll: async () => {
    return apiRequest<any[]>('/user-roles');
  },
};

// Backups API
export const backupsApi = {
  export: async (tables: string[]): Promise<string> => {
    const token = getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/backups/export`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tables }),
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } catch {
        // If response is not JSON, try to get text
        try {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        } catch {
          // Use default error message
        }
      }
      throw new Error(errorMessage);
    }

    // Get response as text since backend sends plain text
    return response.text();
  },
};

// Fab Orders API
export const fabOrdersApi = {
  getAll: async () => {
    return apiRequest<any[]>('/fab-orders');
  },

  getDeclaration: async () => {
    return apiRequest<any[]>('/fab-orders/declaration');
  },

  getById: async (id: string) => {
    return apiRequest<any>(`/fab-orders/${id}`);
  },

  create: async (orderData: any) => {
    return apiRequest<{ success: boolean; id: string }>('/fab-orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  },

  update: async (id: string, orderData: any) => {
    return apiRequest<{ success: boolean }>(`/fab-orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(orderData),
    });
  },

  delete: async (id: string) => {
    return apiRequest<{ success: boolean }>(`/fab-orders/${id}`, {
      method: 'DELETE',
    });
  },
};

// Workshop daily follow-up row (from GET /api/workshop/daily)
export interface WorkshopDailyRow {
  id: number;
  OFID: string;
  date_fabrication: string | null;
  End_Fab_date: string | null;
  Pf_Qty: number;
  Sf_Qty: number;
  Set_qty: number;
  Tester_qty: number;
  Comment_chaine?: string | null;
  chaine_id: string | null;
  sale_order_id: string;
  of_id: string;
  client_name: string | null;
  product_name: string | null;
  num_chaine: number | null;
  chef_name: string | null;
}

// Workshop report row (from GET /api/workshop/report)
export interface WorkshopReportRow {
  id: string;
  of_id: string;
  sale_order_id: string;
  statut_of: string;
  pf_qty: number;
  set_qty: number;
  tester_qty: number;
  client_name: string | null;
  product_name: string | null;
  fabrication_Pf_Qty: number;
  fabrication_Set_qty: number;
  fabrication_Tester_qty: number;
  total_minutes: number;
}

export const workshopReportApi = {
  getReport: async () => {
    return apiRequest<WorkshopReportRow[]>('/workshop/report');
  },
  updateToCloture: async (OFID: string) => {
    return apiRequest<{ success: boolean; message: string }>(
      `/workshop/report/updateToCloture/${encodeURIComponent(OFID)}`,
      { method: 'POST' }
    );
  },
};

// Workshop traceability (fabrication history) row
export interface TraceabilityRow {
  id: number;
  OFID: string;
  Lot_Jus: string | null;
  Valid_date: string | null;
  effectif_Reel: number | null;
  date_fabrication: string | null;
  End_Fab_date: string | null;
  Pf_Qty: number;
  Sf_Qty: number;
  Set_qty: number;
  Tester_qty: number;
  Comment_chaine: string | null;
  sale_order_id: string;
  product_name: string | null;
  client_name: string | null;
}

export const traceabilityApi = {
  getList: async () => {
    return apiRequest<TraceabilityRow[]>('/workshop/traceability');
  },
};

// Fabrication (declaration) API
export const fabricationApi = {
  getByOFID: async (OFID: string) => {
    return apiRequest<any[]>(`/fab-orders/declaration/fabrication-history?OFID=${encodeURIComponent(OFID)}`);
  },

  getDaily: async () => {
    return apiRequest<WorkshopDailyRow[]>('/workshop/daily');
  },

  create: async (data: {
    OFID: string;
    Lot_Jus?: string;
    Valid_date?: string;
    effectif_Reel?: number;
    date_fabrication?: string;
    End_Fab_date?: string;
    Pf_Qty: number;
    Sf_Qty?: number;
    Set_qty: number;
    Tester_qty: number;
    Comment_chaine?: string;
  }) => {
    return apiRequest<{ success: boolean }>('/fabrication', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (
    id: string | number,
    data: {
      Lot_Jus?: string | null;
      Valid_date?: string | null;
      effectif_Reel?: number | null;
      date_fabrication?: string | null;
      End_Fab_date?: string | null;
      Pf_Qty?: number;
      Sf_Qty?: number;
      Set_qty?: number;
      Tester_qty?: number;
      Comment_chaine?: string | null;
    }
  ) => {
    return apiRequest<{ success: boolean }>(`/fab-orders/declaration/fabrication/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string | number) => {
    return apiRequest<{ success: boolean }>(`/fab-orders/declaration/fabrication/${id}`, {
      method: 'DELETE',
    });
  },
};

// Quality / Conformity (Déclaration défaut)
export interface ConformityDetailRow {
  id?: string;
  OFID?: string;
  category_id: string;
  defect_id?: string | null;
  component_name?: string | null;
  qty_nc: number;
  type_product: 'PF' | 'Tester' | 'Set';
  resp_defaut: 'Main d\'oeuvre' | 'Machine' | 'Fournisseur';
  total_nc?: number | null;
  comment?: string | null;
  anomaly_label?: string;
  defect_label?: string;
  responsable?: string | null;
  created_at?: string;
}

export const qualityApi = {
  getConformityTotals: async () => {
    return apiRequest<Record<string, number>>('/quality/conformity-totals');
  },

  getConformityByOFID: async (OFID: string) => {
    return apiRequest<ConformityDetailRow[]>(`/quality/conformity?OFID=${encodeURIComponent(OFID)}`);
  },

  createConformity: async (data: {
    OFID: string;
    fab_order_id?: string | null;
    details: Array<{
      category_id: string;
      defect_id?: string | null;
      component_name?: string | null;
      qty_nc: number;
      type_product: 'PF' | 'Tester' | 'Set';
      resp_defaut: 'Main d\'oeuvre' | 'Machine' | 'Fournisseur';
      total_nc?: number | null;
      comment?: string | null;
    }>;
    comment?: string | null;
    total_nc?: number | null;
  }) => {
    return apiRequest<{ success: boolean }>('/quality/conformity', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateConformity: async (
    id: string,
    data: {
      category_id?: string;
      defect_id?: string | null;
      component_name?: string | null;
      qty_nc?: number;
      type_product?: 'PF' | 'Tester' | 'Set';
      resp_defaut?: 'Main d\'oeuvre' | 'Machine' | 'Fournisseur';
      total_nc?: number | null;
      comment?: string | null;
    }
  ) => {
    return apiRequest<{ success: boolean }>(`/quality/conformity/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteConformity: async (id: string) => {
    return apiRequest<{ success: boolean }>(`/quality/conformity/${id}`, {
      method: 'DELETE',
    });
  },

  getChartsAnomalies: async (start?: string, end?: string) => {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    return apiRequest<{ id: string; label: string; total: number }[]>(`/quality/charts/anomalies?${params.toString()}`);
  },

  getChartsConformity: async (start?: string, end?: string) => {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    return apiRequest<{ date: string; total_nc: number; of_count: number }[]>(`/quality/charts/conformity?${params.toString()}`);
  },
};

// Component Changes (Changement de composants)
export interface ComponentChangeWithProducts {
  id: number;
  ofId: string;
  commande: string;
  nomDuProduit: string;
  originalProductId: string;
  newProductId: string;
  qty: number;
  status: string | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  originalComponentName: string;
  originalComponentCode: string;
  newComponentName: string;
  newComponentCode: string;
}

export interface FabOrderOption {
  OFID: string;
  saleOrderId: string;
  prodName: string;
}

export interface ComponentAutocompleteResult {
  componentCode: string;
  componentName: string;
}

export interface CreateComponentChangeInput {
  of_id: string;
  commande: string;
  nom_du_produit: string;
  original_product_id: string;
  new_product_id: string;
  qty: number;
  comment?: string;
}

export const componentChangesApi = {
  getAll: () =>
    apiRequest<{ data: ComponentChangeWithProducts[] }>('/component-changes'),

  create: (data: CreateComponentChangeInput) =>
    apiRequest<{ success: boolean; message: string }>('/component-changes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: CreateComponentChangeInput) =>
    apiRequest<{ success: boolean; message: string }>(`/component-changes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    apiRequest<{ success: boolean; message: string }>(`/component-changes/${id}`, {
      method: 'DELETE',
    }),

  validate: (id: number) =>
    apiRequest<{ success: boolean; status: string }>(`/component-changes/${id}/validate`, {
      method: 'POST',
    }),

  getOFList: () =>
    apiRequest<{ data: FabOrderOption[] }>('/component-changes/of/list'),

  searchOF: (q: string) =>
    apiRequest<{ data: FabOrderOption[] }>(`/component-changes/of/search?q=${encodeURIComponent(q)}`),

  autocompleteComponents: (params: {
    q?: string;
    of_id?: string;
    type: 'original' | 'new';
    nom_du_produit?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params.q != null) searchParams.set('q', params.q);
    if (params.of_id != null) searchParams.set('of_id', params.of_id);
    searchParams.set('type', params.type);
    if (params.nom_du_produit != null) searchParams.set('nom_du_produit', params.nom_du_produit);
    return apiRequest<{ data: ComponentAutocompleteResult[] }>(
      `/component-changes/products/autocomplete?${searchParams.toString()}`
    );
  },

  /** List all components from product_components (for Nouveau composant dropdown) */
  listAllComponents: (q?: string) => {
    const searchParams = new URLSearchParams();
    if (q != null && q !== '') searchParams.set('q', q);
    return apiRequest<{ data: ComponentAutocompleteResult[] }>(
      `/component-changes/components/list${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    );
  },
};

// Rebut Hors Production (scrap/defauts hors process)
export interface RebutHorsProdRow {
  id: number;
  produit: string;
  composant: string;
  qty: number;
  defaut: string;
  comment: string | null;
  createdBy: string | null;
  demandeur: string | null;
  status: boolean; // true=unlocked, false=locked/validated
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRebutHorsProdInput {
  produit: string;
  composant: string;
  qty: number;
  defaut: string;
  demandeur: string;
  commentaire?: string;
}

export interface UpdateRebutHorsProdInput extends CreateRebutHorsProdInput {}

export const wasteHorsProdApi = {
  getData: (params: {
    startDate?: string;
    endDate?: string;
    showValidated?: boolean;
    page?: number;
    pageSize?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params.startDate) searchParams.set('startDate', params.startDate);
    if (params.endDate) searchParams.set('endDate', params.endDate);
    if (typeof params.showValidated === 'boolean') searchParams.set('showValidated', params.showValidated ? 'true' : 'false');
    if (params.page) searchParams.set('page', String(params.page));
    if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
    return apiRequest<{
      data: RebutHorsProdRow[];
      recordsTotal: number;
      recordsFiltered: number;
      page: number;
      pageSize: number;
    }>(`/components/waste/data?${searchParams.toString()}`);
  },

  getById: (id: number) =>
    apiRequest<RebutHorsProdRow>(`/components/waste/${id}`),

  getProductNames: () =>
    apiRequest<{ data: string[] }>('/components/waste/products'),

  getComponentsByProduct: (productName: string) =>
    apiRequest<{ data: string[] }>(
      `/components/waste/get-components?product_name=${encodeURIComponent(productName)}`
    ),

  getDefauts: () =>
    apiRequest<{ data: string[] }>('/components/waste/defauts'),

  create: (data: CreateRebutHorsProdInput) =>
    apiRequest<{ success: boolean; message: string; id: number }>('/components/waste', {
      method: 'POST',
      body: JSON.stringify({
        produit: data.produit,
        composant: data.composant,
        qty: data.qty,
        defaut: data.defaut,
        demandeur: data.demandeur,
        commentaire: data.commentaire ?? '',
      }),
    }),

  update: (id: number, data: UpdateRebutHorsProdInput) =>
    apiRequest<{ success: boolean; message: string }>(`/components/waste/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        produit: data.produit,
        composant: data.composant,
        qty: data.qty,
        defaut: data.defaut,
        demandeur: data.demandeur,
        commentaire: data.commentaire ?? '',
      }),
    }),

  delete: (id: number) =>
    apiRequest<{ success: boolean; message: string }>(`/components/waste/${id}`, {
      method: 'DELETE',
    }),

  validate: (id: number) =>
    apiRequest<{ success: boolean; message: string }>(`/components/waste/${id}/validate`, {
      method: 'POST',
    }),

  bulkValidate: (ids: number[]) =>
    apiRequest<{ success: boolean; message: string; validated: number; alreadyLocked: number }>(
      '/components/waste/bulk-validate',
      {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }
    ),

  exportCsvText: async (
    filters: { startDate?: string; endDate?: string; showValidated?: boolean; statusFilter?: 'unlocked' | 'locked' | 'all' }
  ) => {
    const searchParams = new URLSearchParams();
    if (filters.startDate) searchParams.set('startDate', filters.startDate);
    if (filters.endDate) searchParams.set('endDate', filters.endDate);
    if (typeof filters.showValidated === 'boolean') searchParams.set('showValidated', filters.showValidated ? 'true' : 'false');
    if (filters.statusFilter && filters.statusFilter !== 'all') searchParams.set('statusFilter', filters.statusFilter);

    const token = getToken();
    const res = await fetch(`${API_URL}/components/waste/export?${searchParams.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(await res.text());
    return res.text();
  },

  exportCsvBlob: async (
    filters: { startDate?: string; endDate?: string; showValidated?: boolean; statusFilter?: 'unlocked' | 'locked' | 'all' }
  ) => {
    const searchParams = new URLSearchParams();
    if (filters.startDate) searchParams.set('startDate', filters.startDate);
    if (filters.endDate) searchParams.set('endDate', filters.endDate);
    if (typeof filters.showValidated === 'boolean') searchParams.set('showValidated', filters.showValidated ? 'true' : 'false');
    if (filters.statusFilter && filters.statusFilter !== 'all') searchParams.set('statusFilter', filters.statusFilter);

    const token = getToken();
    const res = await fetch(`${API_URL}/components/waste/export?${searchParams.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(await res.text());
    return res.blob();
  },
};

export type UnifiedRebutType = 'laquage' | 'hors_prod' | 'serigraphie' | 'conformity';

export interface UnifiedRebutRow {
  uniqueId: string; // `${type}:${sourceId}`
  sourceId: string;
  OFID: string | null;
  dateDeclaration: string | null;
  quantity: number;
  component: string;
  defect: string;
  comment: string | null;
  rebutType: UnifiedRebutType;
  sourceTable: string;
  status: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  produit: string | null;
  chaineId: string | null;
  chaineNum: number | null;
}

export interface UnifiedRebutFilters {
  startDate?: string;
  endDate?: string;
  rebutType?: UnifiedRebutType | '';
  chaineId?: string;
  bottleFilter?: boolean;
  searchText?: string;
  showLocked?: boolean;
}

export const unifiedRebutReportApi = {
  getData: (params: UnifiedRebutFilters & {
    page?: number;
    pageSize?: number;
    sortColumn?: string;
    sortDirection?: 'asc' | 'desc';
  }) => {
    const searchParams = new URLSearchParams();
    if (params.startDate) searchParams.set('startDate', params.startDate);
    if (params.endDate) searchParams.set('endDate', params.endDate);
    if (params.rebutType) searchParams.set('rebutType', params.rebutType);
    if (params.chaineId) searchParams.set('chaineId', params.chaineId);
    if (params.bottleFilter) searchParams.set('bottleFilter', 'true');
    if (params.searchText) searchParams.set('searchText', params.searchText);
    if (typeof params.showLocked === 'boolean') searchParams.set('showLocked', params.showLocked ? 'true' : 'false');
    if (params.page != null) searchParams.set('page', String(params.page));
    if (params.pageSize != null) searchParams.set('pageSize', String(params.pageSize));
    if (params.sortColumn) searchParams.set('sortColumn', params.sortColumn);
    if (params.sortDirection) searchParams.set('sortDirection', params.sortDirection);
    return apiRequest<{
      data: UnifiedRebutRow[];
      recordsTotal: number;
      recordsFiltered: number;
      page: number;
      pageSize: number;
    }>(`/components/waste-report/data?${searchParams.toString()}`);
  },

  getTypes: () =>
    apiRequest<{ data: Array<{ value: string; label: string }> }>('/components/waste-report/types'),

  getChaines: () =>
    apiRequest<{ data: Array<{ id: string; num_chaine: number }> }>('/components/waste-report/chaines'),

  validateSingle: (id: string, type: UnifiedRebutType) =>
    apiRequest<{ success: boolean; message: string }>('/components/waste-report/validate-single', {
      method: 'POST',
      body: JSON.stringify({ id, type }),
    }),

  bulkValidate: (entries: Array<{ id: string; type: UnifiedRebutType }>) =>
    apiRequest<{ success: boolean; validated: number; message: string; errors: string[] }>(
      '/components/waste-report/bulk-validate',
      {
        method: 'POST',
        body: JSON.stringify({ entries }),
      }
    ),

  exportAllText: async (format: 'copy' | 'print', filters: UnifiedRebutFilters) => {
    const searchParams = new URLSearchParams();
    searchParams.set('format', format);
    if (filters.startDate) searchParams.set('startDate', filters.startDate);
    if (filters.endDate) searchParams.set('endDate', filters.endDate);
    if (filters.rebutType) searchParams.set('rebutType', filters.rebutType);
    if (filters.chaineId) searchParams.set('chaineId', filters.chaineId);
    if (filters.bottleFilter) searchParams.set('bottleFilter', 'true');
    if (filters.searchText) searchParams.set('searchText', filters.searchText);
    if (typeof filters.showLocked === 'boolean') searchParams.set('showLocked', filters.showLocked ? 'true' : 'false');
    const token = getToken();
    const res = await fetch(`${API_URL}/components/waste-report/export-all?${searchParams.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(await res.text());
    return res.text();
  },

  exportAllBlob: async (filters: UnifiedRebutFilters) => {
    const searchParams = new URLSearchParams();
    searchParams.set('format', 'excel');
    if (filters.startDate) searchParams.set('startDate', filters.startDate);
    if (filters.endDate) searchParams.set('endDate', filters.endDate);
    if (filters.rebutType) searchParams.set('rebutType', filters.rebutType);
    if (filters.chaineId) searchParams.set('chaineId', filters.chaineId);
    if (filters.bottleFilter) searchParams.set('bottleFilter', 'true');
    if (filters.searchText) searchParams.set('searchText', filters.searchText);
    if (typeof filters.showLocked === 'boolean') searchParams.set('showLocked', filters.showLocked ? 'true' : 'false');
    const token = getToken();
    const res = await fetch(`${API_URL}/components/waste-report/export-all?${searchParams.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(await res.text());
    return res.blob();
  },

  exportPrintBlob: async (filters: UnifiedRebutFilters) => {
    const searchParams = new URLSearchParams();
    searchParams.set('format', 'print');
    if (filters.startDate) searchParams.set('startDate', filters.startDate);
    if (filters.endDate) searchParams.set('endDate', filters.endDate);
    if (filters.rebutType) searchParams.set('rebutType', filters.rebutType);
    if (filters.chaineId) searchParams.set('chaineId', filters.chaineId);
    if (filters.bottleFilter) searchParams.set('bottleFilter', 'true');
    if (filters.searchText) searchParams.set('searchText', filters.searchText);
    if (typeof filters.showLocked === 'boolean') searchParams.set('showLocked', filters.showLocked ? 'true' : 'false');
    const token = getToken();
    const res = await fetch(`${API_URL}/components/waste-report/export-all?${searchParams.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(await res.text());
    return res.blob();
  },
};

export type LaboStatut = 'Planifier' | 'En_cours' | 'Cloture';

export interface LaboOrdre {
  id: number;
  produit: string;
  qty: number;
  instruction: string | null;
  statut: LaboStatut;
  createdAt: string;
  updatedAt: string;
}

export interface LaboDeclaration {
  id: number;
  produit: string;
  qty: number;
  lot: string;
  createdAt: string;
}

export interface LaboDeclarationAll extends LaboDeclaration {
  ofId: number;
  fabricationId: number;
  fabricationProduit: string;
  fabricationQty: number;
  fabricationStatut: LaboStatut;
}

export interface LaboOrdreWithDeclarations extends LaboOrdre {
  declarations: LaboDeclaration[];
}

export interface LaboRack {
  id: number;
  name: string;
  stages: number;
  places: number;
  createdAt: string;
}

export interface LaboStockItem {
  id: number;
  rackId: number;
  stage: number;
  place: number;
  produit: string;
  qty: number;
  lot: string;
  declarationId: number | null;
  createdAt: string;
  updatedAt?: string;
  rackName?: string;
  rackStages?: number;
  rackPlaces?: number;
}

export const laboratoireApi = {
  getOrdres: () => apiRequest<{ success: boolean; data: LaboOrdre[] }>('/laboratoire/ordres'),
  createOrdre: (data: { produit: string; qty: number; instruction?: string; statut?: LaboStatut }) =>
    apiRequest<{ success: boolean; id: number }>('/laboratoire/ordres', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateOrdre: (id: number, data: { produit: string; qty: number; instruction?: string; statut?: LaboStatut }) =>
    apiRequest<{ success: boolean }>(`/laboratoire/ordres/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteOrdre: (id: number) =>
    apiRequest<{ success: boolean }>(`/laboratoire/ordres/${id}`, {
      method: 'DELETE',
    }),
  setStatut: (id: number, statut: LaboStatut) =>
    apiRequest<{ success: boolean }>(`/laboratoire/ordres/${id}/statut`, {
      method: 'PATCH',
      body: JSON.stringify({ statut }),
    }),

  getDeclarations: () =>
    apiRequest<{ success: boolean; data: LaboOrdreWithDeclarations[] }>('/laboratoire/declarations'),
  createDeclaration: (data: { ofId: number; produit: string; qty: number; lot: string }) =>
    apiRequest<{ success: boolean; id: number }>('/laboratoire/declarations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getAllDeclarations: () =>
    apiRequest<{ success: boolean; data: LaboDeclarationAll[] }>('/laboratoire/declarations/all'),
  getHistorique: (ofId: number) =>
    apiRequest<{ success: boolean; data: LaboDeclaration[] }>(`/laboratoire/declarations/${ofId}/historique`),

  getRacks: () =>
    apiRequest<{ success: boolean; data: LaboRack[] }>('/laboratoire/racks'),
  createRack: (data: { name: string; stages: number; places: number }) =>
    apiRequest<{ success: boolean; id: number }>('/laboratoire/racks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteRack: (id: number) =>
    apiRequest<{ success: boolean }>(`/laboratoire/racks/${id}`, {
      method: 'DELETE',
    }),

  getStockFull: () =>
    apiRequest<{ success: boolean; data: LaboStockItem[] }>('/laboratoire/stock/full'),
  getStageStock: (rackId: number, stage: number) =>
    apiRequest<{ success: boolean; data: LaboStockItem[] }>(`/laboratoire/stock/stage?rackId=${rackId}&stage=${stage}`),
  assignToStock: (data: {
    rackId: number;
    stage: number;
    place: number;
    produit: string;
    qty: number;
    lot: string;
    declarationId?: number;
  }) =>
    apiRequest<{ success: boolean; id: number }>('/laboratoire/stock/assign', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  moveProduct: (stockId: number, data: { rackId: number; stage: number; place: number }) =>
    apiRequest<{ success: boolean }>(`/laboratoire/stock/${stockId}/move`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};
