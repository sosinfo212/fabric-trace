import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Package, Loader2, Search, ChevronDown, ChevronRight } from 'lucide-react';

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
}

interface ComponentRow {
  id: string;
  component_name: string;
  component_code: string;
  quantity: string;
}

export default function ProductsPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

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

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('product_name');

      if (productsError) throw productsError;

      const { data: componentsData, error: componentsError } = await supabase
        .from('product_components')
        .select('*');

      if (componentsError) throw componentsError;

      const productsWithComponents = (productsData || []).map(product => ({
        ...product,
        components: (componentsData || []).filter(c => c.product_id === product.id)
      }));

      setProducts(productsWithComponents);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les produits',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchProducts();
    }
  }, [user]);

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
      const { data: productData, error: productError } = await supabase
        .from('products')
        .insert({
          ref_id: formRefId,
          product_name: formProductName,
        })
        .select()
        .single();

      if (productError) throw productError;

      // Create the components
      const componentsToInsert = formRows
        .filter(row => row.component_name || row.component_code)
        .map(row => ({
          product_id: productData.id,
          component_name: row.component_name || null,
          component_code: row.component_code || null,
          quantity: parseFloat(row.quantity) || 0,
        }));

      if (componentsToInsert.length > 0) {
        const { error: componentsError } = await supabase
          .from('product_components')
          .insert(componentsToInsert);

        if (componentsError) throw componentsError;
      }

      toast({ title: 'Succès', description: 'Produit créé avec succès' });
      setIsCreateOpen(false);
      resetForm();
      fetchProducts();
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
      const { error: productError } = await supabase
        .from('products')
        .update({
          ref_id: editRefId,
          product_name: editProductName,
        })
        .eq('id', selectedProduct.id);

      if (productError) throw productError;

      // Delete existing components
      const { error: deleteError } = await supabase
        .from('product_components')
        .delete()
        .eq('product_id', selectedProduct.id);

      if (deleteError) throw deleteError;

      // Insert new components
      const componentsToInsert = editRows
        .filter(row => row.component_name || row.component_code)
        .map(row => ({
          product_id: selectedProduct.id,
          component_name: row.component_name || null,
          component_code: row.component_code || null,
          quantity: parseFloat(row.quantity) || 0,
        }));

      if (componentsToInsert.length > 0) {
        const { error: componentsError } = await supabase
          .from('product_components')
          .insert(componentsToInsert);

        if (componentsError) throw componentsError;
      }

      toast({ title: 'Succès', description: 'Produit mis à jour avec succès' });
      setIsEditOpen(false);
      setSelectedProduct(null);
      fetchProducts();
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
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;

      toast({ title: 'Succès', description: 'Produit supprimé avec succès' });
      fetchProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de supprimer le produit',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (product: Product) => {
    setSelectedProduct(product);
    setEditRefId(product.ref_id);
    setEditProductName(product.product_name);
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
    setIsEditOpen(true);
  };

  const toggleExpand = (productId: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  const filteredProducts = products.filter(
    (product) =>
      product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.ref_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const canManage = hasAccess(['admin']);

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
                  {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''}
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
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
                  {filteredProducts.map((product) => (
                    <>
                      <TableRow key={product.id}>
                        <TableCell className="p-2">
                          {product.components && product.components.length > 0 && (
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
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{product.ref_id}</TableCell>
                        <TableCell>{product.product_name}</TableCell>
                        <TableCell className="text-center">
                          {product.components?.length || 0}
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
                  {filteredProducts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={canManage ? 5 : 4} className="text-center py-8 text-muted-foreground">
                        Aucun produit enregistré
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
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
