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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, AlertTriangle, Folder, Loader2, Search } from 'lucide-react';

interface DefautCategory {
  id: string;
  category_name: string;
  created_at: string;
  defect_count?: number;
}

interface Defaut {
  id: string;
  category_id: string;
  label: string;
  created_at: string;
  category?: {
    id: string;
    category_name: string;
  };
}

export default function DefectsPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [categories, setCategories] = useState<DefautCategory[]>([]);
  const [defects, setDefects] = useState<Defaut[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Category dialog
  const [isCategoryCreateOpen, setIsCategoryCreateOpen] = useState(false);
  const [isCategoryEditOpen, setIsCategoryEditOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<DefautCategory | null>(null);
  const [categoryName, setCategoryName] = useState('');

  // Defect dialog
  const [isDefectCreateOpen, setIsDefectCreateOpen] = useState(false);
  const [isDefectEditOpen, setIsDefectEditOpen] = useState(false);
  const [selectedDefect, setSelectedDefect] = useState<Defaut | null>(null);
  const [defectLabel, setDefectLabel] = useState('');
  const [defectCategoryId, setDefectCategoryId] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('defaut_categories')
        .select('*')
        .order('category_name');

      if (categoriesError) throw categoriesError;

      // Fetch defects with category info
      const { data: defectsData, error: defectsError } = await supabase
        .from('defaut_list')
        .select('*, category:defaut_categories(id, category_name)')
        .order('label');

      if (defectsError) throw defectsError;

      // Count defects per category
      const categoryCounts: Record<string, number> = {};
      defectsData?.forEach((d) => {
        categoryCounts[d.category_id] = (categoryCounts[d.category_id] || 0) + 1;
      });

      const categoriesWithCounts = categoriesData?.map((c) => ({
        ...c,
        defect_count: categoryCounts[c.id] || 0,
      })) || [];

      setCategories(categoriesWithCounts);
      setDefects(defectsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les données',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && hasAccess(['admin'])) {
      fetchData();
    }
  }, [user]);

  // Category handlers
  const handleCreateCategory = async () => {
    if (!categoryName.trim()) {
      toast({ title: 'Erreur', description: 'Le nom est requis', variant: 'destructive' });
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('defaut_categories')
        .insert({ category_name: categoryName.trim() });

      if (error) throw error;

      toast({ title: 'Succès', description: 'Catégorie créée' });
      setIsCategoryCreateOpen(false);
      setCategoryName('');
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditCategory = async () => {
    if (!selectedCategory || !categoryName.trim()) return;

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('defaut_categories')
        .update({ category_name: categoryName.trim() })
        .eq('id', selectedCategory.id);

      if (error) throw error;

      toast({ title: 'Succès', description: 'Catégorie mise à jour' });
      setIsCategoryEditOpen(false);
      setSelectedCategory(null);
      setCategoryName('');
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (category: DefautCategory) => {
    try {
      const { error } = await supabase
        .from('defaut_categories')
        .delete()
        .eq('id', category.id);

      if (error) throw error;

      toast({ title: 'Succès', description: 'Catégorie supprimée' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  // Defect handlers
  const handleCreateDefect = async () => {
    if (!defectLabel.trim() || !defectCategoryId) {
      toast({ title: 'Erreur', description: 'Le libellé et la catégorie sont requis', variant: 'destructive' });
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('defaut_list')
        .insert({ label: defectLabel.trim(), category_id: defectCategoryId });

      if (error) throw error;

      toast({ title: 'Succès', description: 'Défaut créé' });
      setIsDefectCreateOpen(false);
      setDefectLabel('');
      setDefectCategoryId('');
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditDefect = async () => {
    if (!selectedDefect || !defectLabel.trim() || !defectCategoryId) return;

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('defaut_list')
        .update({ label: defectLabel.trim(), category_id: defectCategoryId })
        .eq('id', selectedDefect.id);

      if (error) throw error;

      toast({ title: 'Succès', description: 'Défaut mis à jour' });
      setIsDefectEditOpen(false);
      setSelectedDefect(null);
      setDefectLabel('');
      setDefectCategoryId('');
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDefect = async (defect: Defaut) => {
    try {
      const { error } = await supabase
        .from('defaut_list')
        .delete()
        .eq('id', defect.id);

      if (error) throw error;

      toast({ title: 'Succès', description: 'Défaut supprimé' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  const openCategoryEdit = (category: DefautCategory) => {
    setSelectedCategory(category);
    setCategoryName(category.category_name);
    setIsCategoryEditOpen(true);
  };

  const openDefectEdit = (defect: Defaut) => {
    setSelectedDefect(defect);
    setDefectLabel(defect.label);
    setDefectCategoryId(defect.category_id);
    setIsDefectEditOpen(true);
  };

  const filteredDefects = defects.filter((d) =>
    d.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.category as any)?.category_name?.toLowerCase().includes(searchQuery.toLowerCase())
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

  if (!hasAccess(['admin'])) {
    return <Navigate to="/" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Liste des Défauts</h2>
          <p className="text-muted-foreground">
            Gérez les catégories et les types de défauts
          </p>
        </div>

        <Tabs defaultValue="defects" className="space-y-4">
          <TabsList>
            <TabsTrigger value="defects">Défauts</TabsTrigger>
            <TabsTrigger value="categories">Catégories</TabsTrigger>
          </TabsList>

          {/* Defects Tab */}
          <TabsContent value="defects" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Liste des défauts
                    </CardTitle>
                    <CardDescription>
                      {filteredDefects.length} défaut{filteredDefects.length > 1 ? 's' : ''}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Dialog open={isDefectCreateOpen} onOpenChange={setIsDefectCreateOpen}>
                      <DialogTrigger asChild>
                        <Button disabled={categories.length === 0}>
                          <Plus className="mr-2 h-4 w-4" />
                          Nouveau défaut
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Créer un défaut</DialogTitle>
                          <DialogDescription>Ajoutez un nouveau type de défaut</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Catégorie *</Label>
                            <Select value={defectCategoryId} onValueChange={setDefectCategoryId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner une catégorie" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.category_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Libellé *</Label>
                            <Input
                              placeholder="Nom du défaut"
                              value={defectLabel}
                              onChange={(e) => setDefectLabel(e.target.value)}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsDefectCreateOpen(false)}>
                            Annuler
                          </Button>
                          <Button onClick={handleCreateDefect} disabled={submitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Créer
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
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
                        <TableHead>Libellé</TableHead>
                        <TableHead>Catégorie</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDefects.map((defect) => (
                        <TableRow key={defect.id}>
                          <TableCell className="font-medium">{defect.label}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {(defect.category as any)?.category_name || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openDefectEdit(defect)}>
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
                                    <AlertDialogTitle>Supprimer le défaut ?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Cette action est irréversible.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteDefect(defect)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Supprimer
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredDefects.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                            {categories.length === 0
                              ? 'Créez d\'abord une catégorie'
                              : 'Aucun défaut trouvé'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Folder className="h-5 w-5" />
                      Catégories de défauts
                    </CardTitle>
                    <CardDescription>
                      {categories.length} catégorie{categories.length > 1 ? 's' : ''}
                    </CardDescription>
                  </div>
                  <Dialog open={isCategoryCreateOpen} onOpenChange={setIsCategoryCreateOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Nouvelle catégorie
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Créer une catégorie</DialogTitle>
                        <DialogDescription>Ajoutez une nouvelle catégorie de défauts</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Nom de la catégorie *</Label>
                          <Input
                            placeholder="Ex: Défauts visuels"
                            value={categoryName}
                            onChange={(e) => setCategoryName(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCategoryCreateOpen(false)}>
                          Annuler
                        </Button>
                        <Button onClick={handleCreateCategory} disabled={submitting}>
                          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Créer
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
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
                        <TableHead>Nom</TableHead>
                        <TableHead>Nombre de défauts</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map((category) => (
                        <TableRow key={category.id}>
                          <TableCell className="font-medium">{category.category_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{category.defect_count || 0}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openCategoryEdit(category)}>
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
                                    <AlertDialogTitle>Supprimer la catégorie ?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Cette action supprimera également tous les défauts associés.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteCategory(category)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Supprimer
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {categories.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                            Aucune catégorie enregistrée
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Defect Dialog */}
        <Dialog open={isDefectEditOpen} onOpenChange={setIsDefectEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier le défaut</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Catégorie *</Label>
                <Select value={defectCategoryId} onValueChange={setDefectCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.category_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Libellé *</Label>
                <Input
                  value={defectLabel}
                  onChange={(e) => setDefectLabel(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDefectEditOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleEditDefect} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Category Dialog */}
        <Dialog open={isCategoryEditOpen} onOpenChange={setIsCategoryEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier la catégorie</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nom de la catégorie *</Label>
                <Input
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCategoryEditOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleEditCategory} disabled={submitting}>
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
