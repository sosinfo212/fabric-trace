import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { format } from "date-fns";

type Commande = {
  id: string;
  num_commande: string;
  client_id: string | null;
  date_planifiee: string | null;
  date_debut: string | null;
  date_fin: string | null;
  instruction: string | null;
  clients?: { id: string; name: string } | null;
};

type Client = {
  id: string;
  name: string;
};

const Commandes = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCommande, setEditingCommande] = useState<Commande | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    num_commande: "",
    client_id: "",
    date_planifiee: "",
    date_debut: "",
    date_fin: "",
    instruction: "",
  });

  const queryClient = useQueryClient();
  const { role, loading: roleLoading } = useUserRole();
  const canManage = role === "admin" || role === "planificatrice";

  // Fetch clients for dropdown
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Client[];
    },
  });

  // Fetch commandes
  const { data: commandes = [], isLoading } = useQuery({
    queryKey: ["commandes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commandes")
        .select("*, clients(id, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Commande[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("commandes").insert({
        num_commande: data.num_commande,
        client_id: data.client_id || null,
        date_planifiee: data.date_planifiee || null,
        date_debut: data.date_debut || null,
        date_fin: data.date_fin || null,
        instruction: data.instruction || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commandes"] });
      toast.success("Commande créée avec succès");
      resetForm();
    },
    onError: (error) => {
      toast.error("Erreur lors de la création: " + error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("commandes")
        .update({
          num_commande: data.num_commande,
          client_id: data.client_id || null,
          date_planifiee: data.date_planifiee || null,
          date_debut: data.date_debut || null,
          date_fin: data.date_fin || null,
          instruction: data.instruction || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commandes"] });
      toast.success("Commande mise à jour avec succès");
      resetForm();
    },
    onError: (error) => {
      toast.error("Erreur lors de la mise à jour: " + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commandes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commandes"] });
      toast.success("Commande supprimée avec succès");
    },
    onError: (error) => {
      toast.error("Erreur lors de la suppression: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      num_commande: "",
      client_id: "",
      date_planifiee: "",
      date_debut: "",
      date_fin: "",
      instruction: "",
    });
    setEditingCommande(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (commande: Commande) => {
    setEditingCommande(commande);
    setFormData({
      num_commande: commande.num_commande,
      client_id: commande.client_id || "",
      date_planifiee: commande.date_planifiee || "",
      date_debut: commande.date_debut || "",
      date_fin: commande.date_fin || "",
      instruction: commande.instruction || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.num_commande.trim()) {
      toast.error("Le numéro de commande est requis");
      return;
    }

    if (editingCommande) {
      updateMutation.mutate({ id: editingCommande.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    try {
      return format(new Date(date), "dd/MM/yyyy");
    } catch {
      return "-";
    }
  };

  const filteredCommandes = commandes.filter(
    (c) =>
      c.num_commande.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading || roleLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Commandes</h1>
        {canManage && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle Commande
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingCommande ? "Modifier la commande" : "Nouvelle commande"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="num_commande">N° Commande *</Label>
                  <Input
                    id="num_commande"
                    value={formData.num_commande}
                    onChange={(e) =>
                      setFormData({ ...formData, num_commande: e.target.value })
                    }
                    placeholder="N° Commande"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client">Client</Label>
                  <Select
                    value={formData.client_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, client_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date_planifiee">Date Planifiée</Label>
                    <Input
                      id="date_planifiee"
                      type="date"
                      value={formData.date_planifiee}
                      onChange={(e) =>
                        setFormData({ ...formData, date_planifiee: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date_debut">Date Début</Label>
                    <Input
                      id="date_debut"
                      type="date"
                      value={formData.date_debut}
                      onChange={(e) =>
                        setFormData({ ...formData, date_debut: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date_fin">Date Fin</Label>
                    <Input
                      id="date_fin"
                      type="date"
                      value={formData.date_fin}
                      onChange={(e) =>
                        setFormData({ ...formData, date_fin: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instruction">Instruction</Label>
                  <Textarea
                    id="instruction"
                    value={formData.instruction}
                    onChange={(e) =>
                      setFormData({ ...formData, instruction: e.target.value })
                    }
                    placeholder="Instructions..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingCommande ? "Mettre à jour" : "Créer"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par N° commande ou client..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N° Commande</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date Planifiée</TableHead>
              <TableHead>Date Début</TableHead>
              <TableHead>Date Fin</TableHead>
              <TableHead>Instruction</TableHead>
              {canManage && <TableHead className="w-24">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCommandes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 7 : 6}
                  className="text-center text-muted-foreground py-8"
                >
                  Aucune commande trouvée
                </TableCell>
              </TableRow>
            ) : (
              filteredCommandes.map((commande) => (
                <TableRow key={commande.id}>
                  <TableCell className="font-medium">
                    {commande.num_commande}
                  </TableCell>
                  <TableCell>{commande.clients?.name || "-"}</TableCell>
                  <TableCell>{formatDate(commande.date_planifiee)}</TableCell>
                  <TableCell>{formatDate(commande.date_debut)}</TableCell>
                  <TableCell>{formatDate(commande.date_fin)}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {commande.instruction || "-"}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(commande)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(commande.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Commandes;
