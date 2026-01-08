import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogDescription,
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
import { Plus, Pencil, Trash2, Package, Loader2, Search, Image } from 'lucide-react';

interface Product {
  id: string;
  ref_id: string;
  product_name: string;
  component_name: string | null;
  component_code: string | null;
  quantity: number;
  image_url: string | null;
  created_at: string;
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

  // Form state
  const [formRefId, setFormRefId] = useState('');
  const [formProductName, setFormProductName] = useState('');
  const [formComponentName, setFormComponentName] = useState('');
  const [formComponentCode, setFormComponentCode] = useState('');
  const [formQuantity, setFormQuantity] = useState('0');
  const [formImageUrl, setFormImageUrl] = useState('');

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('product_name');

      if (error) throw error;
      setProducts(data || []);
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
    setFormComponentName('');
    setFormComponentCode('');
    setFormQuantity('0');
    setFormImageUrl('');
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

      const { error } = await supabase.from('products').insert({
        ref_id: formRefId,
        product_name: formProductName,
        component_name: formComponentName || null,
        component_code: formComponentCode || null,
        quantity: parseFloat(formQuantity) || 0,
        image_url: formImageUrl || null,
      });

      if (error) throw error;

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
    if (!selectedProduct || !formRefId || !formProductName) return;

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('products')
        .update({
          ref_id: formRefId,
          product_name: formProductName,
          component_name: formComponentName || null,
          component_code: formComponentCode || null,
          quantity: parseFloat(formQuantity) || 0,
          image_url: formImageUrl || null,
        })
        .eq('id', selectedProduct.id);

      if (error) throw error;

      toast({ title: 'Succès', description: 'Produit mis à jour avec succès' });
      setIsEditOpen(false);
      setSelectedProduct(null);
      resetForm();
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
    setFormRefId(product.ref_id);
    setFormProductName(product.product_name);
    setFormComponentName(product.component_name || '');
    setFormComponentCode(product.component_code || '');
    setFormQuantity(product.quantity.toString());
    setFormImageUrl(product.image_url || '');
    setIsEditOpen(true);
  };

  const filteredProducts = products.filter(
    (product) =>
      product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.ref_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.component_name && product.component_name.toLowerCase().includes(searchTerm.toLowerCase()))
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
              Gérez les produits et composants
            </p>
          </div>
          {canManage && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouveau produit
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Créer un produit</DialogTitle>
                  <DialogDescription>Ajoutez un nouveau produit</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Référence *</Label>
                      <Input
                        placeholder="Ex: REF-001"
                        value={formRefId}
                        onChange={(e) => setFormRefId(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Quantité</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={formQuantity}
                        onChange={(e) => setFormQuantity(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Nom du produit *</Label>
                    <Input
                      placeholder="Nom du produit"
                      value={formProductName}
                      onChange={(e) => setFormProductName(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nom du composant</Label>
                      <Input
                        placeholder="Nom du composant"
                        value={formComponentName}
                        onChange={(e) => setFormComponentName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Code composant</Label>
                      <Input
                        placeholder="Code"
                        value={formComponentCode}
                        onChange={(e) => setFormComponentCode(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>URL de l'image</Label>
                    <Input
                      placeholder="https://..."
                      value={formImageUrl}
                      onChange={(e) => setFormImageUrl(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleCreate} disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Créer
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
                    <TableHead className="w-16">Image</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Nom du produit</TableHead>
                    <TableHead>Composant</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.product_name}
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                            <Image className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{product.ref_id}</TableCell>
                      <TableCell>{product.product_name}</TableCell>
                      <TableCell>{product.component_name || '-'}</TableCell>
                      <TableCell>{product.component_code || '-'}</TableCell>
                      <TableCell className="text-right">{product.quantity}</TableCell>
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
                                    Cette action est irréversible. Le produit "{product.product_name}" sera définitivement supprimé.
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
                  ))}
                  {filteredProducts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={canManage ? 7 : 6} className="text-center py-8 text-muted-foreground">
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Modifier le produit</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Référence *</Label>
                  <Input
                    value={formRefId}
                    onChange={(e) => setFormRefId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantité</Label>
                  <Input
                    type="number"
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nom du produit *</Label>
                <Input
                  value={formProductName}
                  onChange={(e) => setFormProductName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom du composant</Label>
                  <Input
                    value={formComponentName}
                    onChange={(e) => setFormComponentName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Code composant</Label>
                  <Input
                    value={formComponentCode}
                    onChange={(e) => setFormComponentCode(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>URL de l'image</Label>
                <Input
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Annuler
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
