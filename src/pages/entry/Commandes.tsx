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
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { format } from "date-fns";

interface Commande {
  id: string;
  num_commande: string;
  client_id: string | null;
  date_planifiee: string | null;
  date_debut: string | null;
  date_fin: string | null;
  instruction: string | null;
  created_at: string;
  clients?: { id: string; name: string } | null;
}

interface Client {
  id: string;
  name: string;
}

const Commandes = () => {
  const [isOpen, setIsOpen] = useState(false);
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
  const { role } = useUserRole();
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
        .select(`
          *,
          clients (id, name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Commande[];
    },
  });

  // Create commande
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
      toast({ title: "Commande créée avec succès" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Update commande
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
      toast({ title: "Commande mise à jour avec succès" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Delete commande
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commandes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commandes"] });
      toast({ title: "Commande supprimée avec succès" });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
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
    setIsOpen(false);
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
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.num_commande.trim()) {
      toast({ title: "Le numéro de commande est requis", variant: "destructive" });
      return;
    }

    if (editingCommande) {
      updateMutation.mutate({ id: editingCommande.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredCommandes = commandes.filter(
    (c) =>
      c.num_commande.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Commandes</h1>
        {canManage && (
          <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsOpen(open); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle Commande
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingCommande ? "Modifier la Commande" : "Nouvelle Commande"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="num_commande">N° Commande *</Label>
                    <Input
                      id="num_commande"
                      value={formData.num_commande}
                      onChange={(e) => setFormData({ ...formData, num_commande: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client_id">Client</Label>
                    <Select
                      value={formData.client_id}
                      onValueChange={(value) => setFormData({ ...formData, client_id: value })}
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
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date_planifiee">Date Planifiée</Label>
                    <Input
                      id="date_planifiee"
                      type="date"
                      value={formData.date_planifiee}
                      onChange={(e) => setFormData({ ...formData, date_planifiee: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date_debut">Date Début</Label>
                    <Input
                      id="date_debut"
                      type="date"
                      value={formData.date_debut}
                      onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date_fin">Date Fin</Label>
                    <Input
                      id="date_fin"
                      type="date"
                      value={formData.date_fin}
                      onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instruction">Instruction</Label>
                  <Textarea
                    id="instruction"
                    value={formData.instruction}
                    onChange={(e) => setFormData({ ...formData, instruction: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Annuler
                  </Button>
                  <Button type="submit">
                    {editingCommande ? "Mettre à jour" : "Créer"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-8">Chargement...</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Commande</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date Planifiée</TableHead>
                <TableHead>Date Début</TableHead>
                <TableHead>Date Fin</TableHead>
                <TableHead>Instruction</TableHead>
                {canManage && <TableHead className="w-[100px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCommandes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 7 : 6} className="text-center py-8 text-muted-foreground">
                    Aucune commande trouvée
                  </TableCell>
                </TableRow>
              ) : (
                filteredCommandes.map((commande) => (
                  <TableRow key={commande.id}>
                    <TableCell className="font-medium">{commande.num_commande}</TableCell>
                    <TableCell>{commande.clients?.name || "-"}</TableCell>
                    <TableCell>{formatDate(commande.date_planifiee)}</TableCell>
                    <TableCell>{formatDate(commande.date_debut)}</TableCell>
                    <TableCell>{formatDate(commande.date_fin)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {commande.instruction || "-"}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(commande)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(commande.id)}
                          >
                            <Trash2 className="h-4 w-4" />
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
      )}
    </div>
  );
};

export default Commandes;
