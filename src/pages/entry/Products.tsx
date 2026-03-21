import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { productsApi, productComponentsApi } from '@/lib/api';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Package, Loader2, Search, ChevronDown, ChevronRight, Upload, FileSpreadsheet } from 'lucide-react';

interface ProductComponent {
  id: string;
  product_id: string;
  component_name: string | null;
  component_code: string | null;
  quantity: number;
}

interface Product {
  id: string;
  ref_id: string;
  product_name: string;
  image_url: string | null;
  created_at: string;
  components?: ProductComponent[];
  componentsLoaded?: boolean;
}

interface ComponentRow {
  id: string;
  component_name: string;
  component_code: string;
  quantity: string;
}

const ITEMS_PER_PAGE = 50;

export default function ProductsPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasMenuAccess, isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [loadingComponents, setLoadingComponents] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);

  // Form state for creating
  const [formRows, setFormRows] = useState<ComponentRow[]>([
    { id: crypto.randomUUID(), component_name: '', component_code: '', quantity: '0' }
  ]);
  const [formRefId, setFormRefId] = useState('');
  const [formProductName, setFormProductName] = useState('');

  // Edit form state
  const [editRefId, setEditRefId] = useState('');
  const [editProductName, setEditProductName] = useState('');
  const [editRows, setEditRows] = useState<ComponentRow[]>([]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmedSearch = searchTerm.trim();
      setDebouncedSearchTerm(trimmedSearch);
      setCurrentPage(1); // Reset to first page on search
      console.log('Debounced search term:', trimmedSearch);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch products with pagination
  const fetchProducts = useCallback(async (page: number = 1, search: string = '') => {
    setLoading(true);
    try {
      console.log('Fetching products - Page:', page, 'Search:', search);
      const response = await productsApi.getPaginated(page, ITEMS_PER_PAGE, search);
      
      console.log('API Response:', response); // Debug log
      console.log('Products received:', response.data?.length || 0);
      
      // Handle response structure - check if it's the new paginated format or old array format
      if (Array.isArray(response)) {
        // Old format (array) - fallback for backward compatibility
        console.warn('Received array format, converting to paginated format');
        setProducts(response.map((p: any) => ({ ...p, componentsLoaded: false })));
        setTotalPages(1);
        setTotal(response.length);
        setCurrentPage(1);
      } else if (response && response.data && Array.isArray(response.data)) {
        // New paginated format
        setProducts(response.data.map((p: any) => ({ ...p, componentsLoaded: false })));
        setTotalPages(response.pagination?.totalPages || 1);
        setTotal(response.pagination?.total || 0);
        setCurrentPage(response.pagination?.page || page);
      } else {
        console.error('Invalid response structure:', response);
        toast({
          title: 'Erreur',
          description: 'Format de réponse invalide du serveur',
          variant: 'destructive',
        });
        setProducts([]);
        setTotalPages(1);
        setTotal(0);
      }
    } catch (error: any) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de charger les produits',
        variant: 'destructive',
      });
      setProducts([]);
      setTotalPages(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Load products when page or search changes
  useEffect(() => {
    if (user) {
      fetchProducts(currentPage, debouncedSearchTerm);
    }
  }, [user, currentPage, debouncedSearchTerm, fetchProducts]);

  // Lazy load components when product is expanded
  const loadComponents = useCallback(async (productId: string) => {
    // Check if already loaded
    const product = products.find(p => p.id === productId);
    if (product?.componentsLoaded) {
      return;
    }

    setLoadingComponents(prev => new Set(prev).add(productId));
    try {
      const components = await productComponentsApi.getByProduct(productId);
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.id === productId
            ? { ...p, components, componentsLoaded: true }
            : p
        )
      );
    } catch (error) {
      console.error('Error loading components:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les composants',
        variant: 'destructive',
      });
    } finally {
      setLoadingComponents(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  }, [products, toast]);

  const toggleExpand = useCallback((productId: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
      // Load components when expanding
      loadComponents(productId);
    }
    setExpandedProducts(newExpanded);
  }, [expandedProducts, loadComponents]);

  const resetForm = () => {
    setFormRefId('');
    setFormProductName('');
    setFormRows([{ id: crypto.randomUUID(), component_name: '', component_code: '', quantity: '0' }]);
  };

  const addRow = () => {
    setFormRows([...formRows, { id: crypto.randomUUID(), component_name: '', component_code: '', quantity: '0' }]);
  };

  const removeRow = (id: string) => {
    if (formRows.length > 1) {
      setFormRows(formRows.filter(row => row.id !== id));
    }
  };

  const updateRow = (id: string, field: keyof ComponentRow, value: string) => {
    setFormRows(formRows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const addEditRow = () => {
    setEditRows([...editRows, { id: crypto.randomUUID(), component_name: '', component_code: '', quantity: '0' }]);
  };

  const removeEditRow = (id: string) => {
    if (editRows.length > 1) {
      setEditRows(editRows.filter(row => row.id !== id));
    }
  };

  const updateEditRow = (id: string, field: keyof ComponentRow, value: string) => {
    setEditRows(editRows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const handleCreate = async () => {
    if (!formRefId || !formProductName) {
      toast({
        title: 'Erreur',
        description: 'La référence et le nom du produit sont requis',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      // Create the product
      const { id: productId } = await productsApi.create({
        ref_id: formRefId,
        product_name: formProductName,
      });

      // Create the components
      const componentsToInsert = formRows.filter(row => row.component_name || row.component_code);
      
      for (const row of componentsToInsert) {
        await productComponentsApi.create(productId, {
          component_name: row.component_name,
          component_code: row.component_code || undefined,
          quantity: parseFloat(row.quantity) || 0,
        });
      }

      toast({ title: 'Succès', description: 'Produit créé avec succès' });
      setIsCreateOpen(false);
      resetForm();
      fetchProducts(currentPage, debouncedSearchTerm);
    } catch (error: any) {
      console.error('Error creating product:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de créer le produit',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedProduct || !editRefId || !editProductName) return;

    try {
      setSubmitting(true);

      // Update the product
      await productsApi.update(selectedProduct.id, {
        ref_id: editRefId,
        product_name: editProductName,
      });

      // Get existing components and delete them
      const existingComponents = await productComponentsApi.getByProduct(selectedProduct.id);
      for (const component of existingComponents) {
        await productComponentsApi.delete(component.id);
      }

      // Insert new components
      const componentsToInsert = editRows.filter(row => row.component_name || row.component_code);
      
      for (const row of componentsToInsert) {
        await productComponentsApi.create(selectedProduct.id, {
          component_name: row.component_name,
          component_code: row.component_code || undefined,
          quantity: parseFloat(row.quantity) || 0,
        });
      }

      toast({ title: 'Succès', description: 'Produit mis à jour avec succès' });
      setIsEditOpen(false);
      setSelectedProduct(null);
      fetchProducts(currentPage, debouncedSearchTerm);
    } catch (error: any) {
      console.error('Error updating product:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de mettre à jour le produit',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (product: Product) => {
    try {
      // Delete components first
      const components = await productComponentsApi.getByProduct(product.id);
      for (const component of components) {
        await productComponentsApi.delete(component.id);
      }
      
      // Delete product
      await productsApi.delete(product.id);

      toast({ title: 'Succès', description: 'Produit supprimé avec succès' });
      fetchProducts(currentPage, debouncedSearchTerm);
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de supprimer le produit',
        variant: 'destructive',
      });
    }
  };

  // Simple CSV parser that handles quoted values
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    // Add last field
    result.push(current.trim());
    return result;
  };

  // Handle CSV import
  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResults(null);

    try {
      const text = await file.text();
      // Handle both Windows (\r\n) and Unix (\n) line endings
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({
          title: 'Erreur',
          description: 'Le fichier CSV doit contenir au moins un en-tête et une ligne de données',
          variant: 'destructive',
        });
        setImporting(false);
        return;
      }

      // Parse header
      const header = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
      const requiredHeaders = ['ref_id', 'component_name', 'quantity'];
      const missingHeaders = requiredHeaders.filter(h => !header.includes(h));

      if (missingHeaders.length > 0) {
        toast({
          title: 'Erreur',
          description: `En-têtes manquants: ${missingHeaders.join(', ')}. En-têtes trouvés: ${header.join(', ')}`,
          variant: 'destructive',
        });
        setImporting(false);
        return;
      }

      // Parse rows
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue; // Skip empty lines
        
        const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, '').trim());
        const row: any = {};
        
        header.forEach((h, idx) => {
          row[h] = values[idx] || '';
        });

        // Skip rows with all empty values
        if (!row.ref_id && !row.component_name && !row.quantity) {
          continue;
        }

        // Map to expected format
        rows.push({
          ref_id: row.ref_id || '',
          component_name: row.component_name || '',
          component_code: row.component_code || '',
          quantity: row.quantity || '0',
        });
      }

      if (rows.length === 0) {
        toast({
          title: 'Erreur',
          description: 'Aucune donnée valide à importer',
          variant: 'destructive',
        });
        setImporting(false);
        return;
      }

      console.log(`Importing ${rows.length} rows...`);

      // Process in batches to avoid payload size limits
      // Note: Server must be restarted after setting body size limit to 50mb in server/index.js
      const BATCH_SIZE = 25; // Process 25 rows at a time (small batches to avoid 413 errors)
      const batches = [];
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        batches.push(rows.slice(i, i + BATCH_SIZE));
      }

      const allResults = {
        success: [],
        errors: [],
        skipped: [],
      };

      // Process batches sequentially with progress updates
      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];
        const progress = Math.round(((batchIdx + 1) / batches.length) * 100);
        console.log(`Processing batch ${batchIdx + 1}/${batches.length} (${batch.length} rows)... ${progress}%`);
        
        try {
          const result = await productComponentsApi.importFromCSV(batch);
          
          // Merge results - backend returns { summary: {}, details: { success: [], errors: [], skipped: [] } }
          if (result.details) {
            allResults.success.push(...(result.details.success || []));
            allResults.errors.push(...(result.details.errors || []));
            allResults.skipped.push(...(result.details.skipped || []));
          }
        } catch (error: any) {
          console.error(`Error processing batch ${batchIdx + 1}:`, error);
          // Add errors for this batch
          batch.forEach((row: any, idx: number) => {
            allResults.errors.push({
              line: batchIdx * BATCH_SIZE + idx + 2, // +2 for header and 0-index
              ref_id: row.ref_id || '',
              error: error.message || 'Erreur lors du traitement du lot',
            });
          });
        }
      }

      // Create summary matching backend format
      const result = {
        summary: {
          total: rows.length,
          imported: allResults.success.length,
          errors: allResults.errors.length,
          skipped: allResults.skipped.length,
        },
        details: allResults,
      };

      setImportResults(result);

      if (result.summary.imported > 0) {
        toast({
          title: 'Succès',
          description: `${result.summary.imported} composant(s) importé(s) avec succès`,
        });
        // Refresh products
        fetchProducts(currentPage, debouncedSearchTerm);
      }

      if (result.summary.errors > 0 || result.summary.skipped > 0) {
        toast({
          title: 'Importation terminée',
          description: `${result.summary.imported} importé(s), ${result.summary.errors} erreur(s), ${result.summary.skipped} ignoré(s)`,
          variant: result.summary.imported > 0 ? 'default' : 'destructive',
        });
      }
    } catch (error: any) {
      console.error('CSV import error:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Erreur lors de l\'importation du fichier CSV',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const openEditDialog = async (product: Product) => {
    setSelectedProduct(product);
    setEditRefId(product.ref_id);
    setEditProductName(product.product_name);
    
    // Load components if not already loaded
    if (!product.componentsLoaded) {
      try {
        const components = await productComponentsApi.getByProduct(product.id);
        setEditRows(
          components && components.length > 0
            ? components.map((c: any) => ({
                id: c.id,
                component_name: c.component_name || '',
                component_code: c.component_code || '',
                quantity: c.quantity.toString(),
              }))
            : [{ id: crypto.randomUUID(), component_name: '', component_code: '', quantity: '0' }]
        );
      } catch (error) {
        console.error('Error loading components for edit:', error);
        setEditRows([{ id: crypto.randomUUID(), component_name: '', component_code: '', quantity: '0' }]);
      }
    } else {
      setEditRows(
        product.components && product.components.length > 0
          ? product.components.map(c => ({
              id: c.id,
              component_name: c.component_name || '',
              component_code: c.component_code || '',
              quantity: c.quantity.toString(),
            }))
          : [{ id: crypto.randomUUID(), component_name: '', component_code: '', quantity: '0' }]
      );
    }
    setIsEditOpen(true);
  };

  // Generate pagination items
  const paginationItems = useMemo(() => {
    const items = [];
    const maxVisible = 7;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    if (start > 1) {
      items.push(
        <PaginationItem key={1}>
          <PaginationLink onClick={() => setCurrentPage(1)}>1</PaginationLink>
        </PaginationItem>
      );
      if (start > 2) {
        items.push(
          <PaginationItem key="ellipsis-start">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
    }

    for (let i = start; i <= end; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            onClick={() => setCurrentPage(i)}
            isActive={i === currentPage}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        items.push(
          <PaginationItem key="ellipsis-end">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink onClick={() => setCurrentPage(totalPages)}>{totalPages}</PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  }, [currentPage, totalPages]);

  if (authLoading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const canAccessPage = hasMenuAccess('/entry/products');
  const canManage = isAdmin;

  if (!canAccessPage) {
    return <Navigate to="/" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Produits</h2>
            <p className="text-muted-foreground">
              Gérez les produits et leurs composants
            </p>
          </div>
          {canManage && (
            <>
              <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Importer CSV
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Importer des composants depuis CSV</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Format CSV attendu: <code className="bg-muted px-1 py-0.5 rounded">ref_id,component_name,component_code,quantity</code>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Les colonnes requises sont: <strong>ref_id</strong>, <strong>component_name</strong>, <strong>quantity</strong>. 
                        <strong>component_code</strong> est optionnel.
                      </p>
                    </div>
                    <div>
                      <Input
                        type="file"
                        accept=".csv"
                        onChange={handleCSVImport}
                        disabled={importing}
                        className="cursor-pointer"
                      />
                    </div>
                    {importResults && (
                      <div className="space-y-2">
                        <div className="p-4 border rounded-lg">
                          <h4 className="font-semibold mb-2">Résultats de l'importation</h4>
                          <div className="space-y-1 text-sm">
                            <p>Total: {importResults.summary.total}</p>
                            <p className="text-green-600">✓ Importés: {importResults.summary.imported}</p>
                            <p className="text-yellow-600">⊘ Ignorés: {importResults.summary.skipped}</p>
                            <p className="text-red-600">✗ Erreurs: {importResults.summary.errors}</p>
                          </div>
                        </div>
                        {importResults.details.errors.length > 0 && (
                          <div className="p-4 border border-red-200 rounded-lg bg-red-50 max-h-48 overflow-y-auto">
                            <h5 className="font-semibold text-red-800 mb-2">Erreurs:</h5>
                            <ul className="space-y-1 text-xs">
                              {importResults.details.errors.map((err: any, idx: number) => (
                                <li key={idx} className="text-red-700">
                                  Ligne {err.line} ({err.ref_id}): {err.error}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {importResults.details.skipped.length > 0 && (
                          <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50 max-h-48 overflow-y-auto">
                            <h5 className="font-semibold text-yellow-800 mb-2">Ignorés (doublons):</h5>
                            <ul className="space-y-1 text-xs">
                              {importResults.details.skipped.map((skip: any, idx: number) => (
                                <li key={idx} className="text-yellow-700">
                                  Ligne {skip.line} ({skip.ref_id} - {skip.component_name}): {skip.error}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    {importing && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Importation en cours...
                      </div>
                    )}
                    <Button variant="secondary" onClick={() => { setIsImportOpen(false); setImportResults(null); }} disabled={importing}>
                      Fermer
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Nouveau produit
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Ajouter un produit</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      placeholder="Référence *"
                      value={formRefId}
                      onChange={(e) => setFormRefId(e.target.value)}
                    />
                    <Input
                      placeholder="Nom du produit *"
                      value={formProductName}
                      onChange={(e) => setFormProductName(e.target.value)}
                    />
                  </div>
                  
                  <Button type="button" onClick={addRow} variant="default" size="sm" className="bg-green-500 hover:bg-green-600">
                    <Plus className="mr-1 h-4 w-4" />
                    Add Row
                  </Button>

                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Nom Composant</TableHead>
                          <TableHead>Code Composant</TableHead>
                          <TableHead>Quantité</TableHead>
                          <TableHead className="w-20">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="p-2">
                              <Input
                                value={row.component_name}
                                onChange={(e) => updateRow(row.id, 'component_name', e.target.value)}
                                placeholder="Nom du composant"
                              />
                            </TableCell>
                            <TableCell className="p-2">
                              <Input
                                value={row.component_code}
                                onChange={(e) => updateRow(row.id, 'component_code', e.target.value)}
                                placeholder="Code"
                              />
                            </TableCell>
                            <TableCell className="p-2">
                              <Input
                                type="number"
                                value={row.quantity}
                                onChange={(e) => updateRow(row.id, 'quantity', e.target.value)}
                                placeholder="0"
                              />
                            </TableCell>
                            <TableCell className="p-2">
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                onClick={() => removeRow(row.id)}
                                disabled={formRows.length === 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>
                    Fermer
                  </Button>
                  <Button onClick={handleCreate} disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Créer le produit
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Liste des produits
                </CardTitle>
                <CardDescription>
                  {debouncedSearchTerm ? (
                    products.length === 0 ? (
                      <span className="text-destructive font-medium">
                        Aucun résultat trouvé pour "{debouncedSearchTerm}"
                      </span>
                    ) : (
                      <>
                        {products.length} résultat{products.length > 1 ? 's' : ''} trouvé{products.length > 1 ? 's' : ''} pour "{debouncedSearchTerm}"
                        {total > products.length && ` sur ${total.toLocaleString()} au total`}
                      </>
                    )
                  ) : (
                    <>
                      {total.toLocaleString()} produit{total > 1 ? 's' : ''} au total
                    </>
                  )}
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom ou référence..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-7 w-7"
                    onClick={() => setSearchTerm('')}
                  >
                    ×
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Référence</TableHead>
                      <TableHead>Nom du produit</TableHead>
                      <TableHead className="text-center">Composants</TableHead>
                      {canManage && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <>
                        <TableRow key={product.id}>
                          <TableCell className="p-2">
                            {product.componentsLoaded && product.components && product.components.length > 0 ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => toggleExpand(product.id)}
                              >
                                {expandedProducts.has(product.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => toggleExpand(product.id)}
                                disabled={loadingComponents.has(product.id)}
                              >
                                {loadingComponents.has(product.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{product.ref_id}</TableCell>
                          <TableCell>{product.product_name}</TableCell>
                          <TableCell className="text-center">
                            {product.componentsLoaded
                              ? product.components?.length || 0
                              : '-'}
                          </TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(product)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Supprimer le produit ?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Cette action est irréversible. Le produit "{product.product_name}" et tous ses composants seront définitivement supprimés.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDelete(product)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Supprimer
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                        {expandedProducts.has(product.id) && product.components && product.components.length > 0 && (
                          <TableRow key={`${product.id}-components`} className="bg-muted/30">
                            <TableCell colSpan={canManage ? 5 : 4} className="p-0">
                              <div className="pl-12 pr-4 py-2">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Nom Composant</TableHead>
                                      <TableHead>Code Composant</TableHead>
                                      <TableHead className="text-right">Quantité</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {product.components.map((component) => (
                                      <TableRow key={component.id}>
                                        <TableCell>{component.component_name || '-'}</TableCell>
                                        <TableCell>{component.component_code || '-'}</TableCell>
                                        <TableCell className="text-right">{component.quantity}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                    {products.length === 0 && !loading && (
                      <TableRow>
                        <TableCell colSpan={canManage ? 5 : 4} className="text-center py-12">
                          <div className="flex flex-col items-center gap-2">
                            <Package className="h-12 w-12 text-muted-foreground/50" />
                            <p className="text-lg font-medium text-muted-foreground">
                              {debouncedSearchTerm 
                                ? `Aucun produit trouvé pour "${debouncedSearchTerm}"`
                                : 'Aucun produit enregistré'}
                            </p>
                            {debouncedSearchTerm && (
                              <p className="text-sm text-muted-foreground">
                                Essayez de modifier vos critères de recherche
                              </p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-center">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>
                        {paginationItems}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Modifier le produit</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="Référence *"
                  value={editRefId}
                  onChange={(e) => setEditRefId(e.target.value)}
                />
                <Input
                  placeholder="Nom du produit *"
                  value={editProductName}
                  onChange={(e) => setEditProductName(e.target.value)}
                />
              </div>
              
              <Button type="button" onClick={addEditRow} variant="default" size="sm" className="bg-green-500 hover:bg-green-600">
                <Plus className="mr-1 h-4 w-4" />
                Add Row
              </Button>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Nom Composant</TableHead>
                      <TableHead>Code Composant</TableHead>
                      <TableHead>Quantité</TableHead>
                      <TableHead className="w-20">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="p-2">
                          <Input
                            value={row.component_name}
                            onChange={(e) => updateEditRow(row.id, 'component_name', e.target.value)}
                            placeholder="Nom du composant"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            value={row.component_code}
                            onChange={(e) => updateEditRow(row.id, 'component_code', e.target.value)}
                            placeholder="Code"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            value={row.quantity}
                            onChange={(e) => updateEditRow(row.id, 'quantity', e.target.value)}
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            onClick={() => removeEditRow(row.id)}
                            disabled={editRows.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setIsEditOpen(false)}>
                Fermer
              </Button>
              <Button onClick={handleEdit} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
