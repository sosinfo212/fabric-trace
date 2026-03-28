import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { fabOrdersApi, chainsApi, clientsApi, productsApi, commandesApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableCombobox, ComboboxOption } from '@/components/ui/searchable-combobox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/hooks/use-toast';
import { Loader2, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = ['Planifié', 'En cours', 'Réalisé', 'Cloturé', 'Suspendu'] as const;

const formSchema = z.object({
  of_id: z.string().min(1, 'OF ID requis').max(255),
  product_id: z.string().optional(),
  prod_ref: z.string().max(255).optional(),
  prod_name: z.string().max(255).optional(),
  chaine_id: z.string().min(1, 'Chaîne requise'),
  sale_order_id: z.string().min(1, 'N° Commande requis').max(255),
  client_id: z.string().min(1, 'Client requis'),
  date_fabrication: z.date().optional(),
  pf_qty: z.coerce.number().min(0).default(0),
  set_qty: z.coerce.number().min(0).default(0),
  tester_qty: z.coerce.number().min(0).default(0),
  lot_set: z.string().default(''),
  instruction: z.string().optional(),
  comment: z.string().optional(),
  statut_of: z.enum(STATUS_OPTIONS).default('Planifié'),
});

type FormValues = z.infer<typeof formSchema>;

export default function FabOrderCreatePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();

  const canAccess = hasMenuAccess('/atelier/fab-orders');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      of_id: '',
      product_id: '',
      prod_ref: '',
      prod_name: '',
      sale_order_id: '',
      lot_set: '',
      pf_qty: 0,
      set_qty: 0,
      tester_qty: 0,
      instruction: '',
      comment: '',
      statut_of: 'Planifié',
    },
  });

  // Fetch chains
  const { data: chaines } = useQuery({
    queryKey: ['chaines'],
    queryFn: async () => {
      const data = await chainsApi.getAll();
      return data.map((c: any) => ({ id: c.id, num_chaine: c.num_chaine }));
    },
    enabled: !!user,
  });

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const data = await clientsApi.getAll();
      return data.map((c: any) => ({ id: c.id, name: c.name, designation: c.designation, instruction: c.instruction }));
    },
    enabled: !!user,
  });

  // Fetch commandes
  const { data: commandes } = useQuery({
    queryKey: ['commandes'],
    queryFn: async () => {
      const data = await commandesApi.getAll();
      return data.map((c: any) => ({ 
        id: c.id, 
        num_commande: c.num_commande,
        client_id: c.client_id,
        client_name: c.client_name
      }));
    },
    enabled: !!user,
  });

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const data = await productsApi.getAll();
      return data.map((p: any) => ({ id: p.id, ref_id: p.ref_id, product_name: p.product_name }));
    },
    enabled: !!user,
  });

  // Prepare options for comboboxes
  const commandeOptions: ComboboxOption[] = useMemo(() => 
    commandes?.map(c => ({
      value: c.num_commande,
      label: c.num_commande,
      searchTerms: [c.num_commande],
    })) || [],
    [commandes]
  );

  const clientOptions: ComboboxOption[] = useMemo(() => 
    clients?.map(c => ({
      value: c.name,
      label: c.designation || c.name,
      searchTerms: [c.name, c.designation || ''],
    })) || [],
    [clients]
  );

  const chaineOptions: ComboboxOption[] = useMemo(() => 
    chaines?.map(c => ({
      value: c.id,
      label: `Chaîne ${c.num_chaine}`,
      searchTerms: [`Chaîne ${c.num_chaine}`, String(c.num_chaine)],
    })) || [],
    [chaines]
  );

  const productOptions: ComboboxOption[] = useMemo(() => 
    products?.map(p => ({
      value: p.id,
      label: `${p.product_name} (${p.ref_id})`,
      searchTerms: [p.product_name, p.ref_id],
    })) || [],
    [products]
  );

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      await fabOrdersApi.create({
        of_id: values.of_id,
        product_id: values.product_id || undefined,
        prod_ref: values.prod_ref || undefined,
        prod_name: values.prod_name || undefined,
        chaine_id: values.chaine_id,
        sale_order_id: values.sale_order_id,
        client_id: values.client_id,
        date_fabrication: values.date_fabrication?.toISOString() || undefined,
        pf_qty: values.pf_qty,
        set_qty: values.set_qty,
        tester_qty: values.tester_qty,
        lot_set: values.lot_set,
        instruction: values.instruction || undefined,
        comment: values.comment || undefined,
        statut_of: values.statut_of,
      });
    },
    onSuccess: () => {
      toast({ title: 'Ordre créé avec succès' });
      navigate('/atelier/fab-orders');
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Handle commande change - fill client
  const handleCommandeChange = (commandeNum: string) => {
    form.setValue('sale_order_id', commandeNum);
    const commande = commandes?.find((c) => c.num_commande === commandeNum);
    if (commande?.client_id && commande?.client_name) {
      // Find the client by ID to get the name
      const client = clients?.find((c) => c.id === commande.client_id);
      if (client) {
        form.setValue('client_id', client.name);
        // Also fill instruction if available
        if (client.instruction) {
          form.setValue('instruction', client.instruction);
        }
      }
    }
  };

  // Handle client change - fill instruction
  const handleClientChange = (clientName: string) => {
    form.setValue('client_id', clientName);
    const client = clients?.find((c) => c.name === clientName);
    if (client?.instruction) {
      form.setValue('instruction', client.instruction);
    }
  };

  // Handle product change - fill ref and name
  const handleProductChange = (productId: string) => {
    form.setValue('product_id', productId);
    const product = products?.find((p) => p.id === productId);
    if (product) {
      form.setValue('prod_ref', product.ref_id);
      form.setValue('prod_name', product.product_name);
    } else {
      form.setValue('prod_ref', '');
      form.setValue('prod_name', '');
    }
  };

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(values);
  };

  if (authLoading || roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (!canAccess) {
    navigate('/');
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Nouvel Ordre de Fabrication</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informations de l'Ordre</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="of_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>OF ID *</FormLabel>
                        <FormControl>
                          <Input placeholder="OF-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sale_order_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>N° Commande *</FormLabel>
                        <FormControl>
                          <SearchableCombobox
                            options={commandeOptions}
                            value={field.value}
                            onValueChange={handleCommandeChange}
                            placeholder="Sélectionner une commande"
                            searchPlaceholder="Rechercher une commande..."
                            emptyText="Aucune commande trouvée"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="client_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client *</FormLabel>
                        <FormControl>
                          <SearchableCombobox
                            options={clientOptions}
                            value={field.value}
                            onValueChange={handleClientChange}
                            placeholder="Sélectionner un client"
                            searchPlaceholder="Rechercher un client..."
                            emptyText="Aucun client trouvé"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="chaine_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chaîne *</FormLabel>
                        <FormControl>
                          <SearchableCombobox
                            options={chaineOptions}
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="Sélectionner une chaîne"
                            searchPlaceholder="Rechercher une chaîne..."
                            emptyText="Aucune chaîne trouvée"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="product_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Produit</FormLabel>
                        <FormControl>
                          <SearchableCombobox
                            options={productOptions}
                            value={field.value || ''}
                            onValueChange={handleProductChange}
                            placeholder="Sélectionner un produit"
                            searchPlaceholder="Rechercher par nom ou référence..."
                            emptyText="Aucun produit trouvé"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="date_fabrication"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Date de Fabrication</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  'w-full pl-3 text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {field.value ? (
                                  format(field.value, 'dd/MM/yyyy', { locale: fr })
                                ) : (
                                  <span>Sélectionner une date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <FormField
                    control={form.control}
                    name="statut_of"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Statut</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pf_qty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PF Qty</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="set_qty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Set Qty</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tester_qty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tester Qty</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lot_set"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lot/Set</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="instruction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instructions</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Instructions spéciales..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="comment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commentaire</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Commentaires..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/atelier/fab-orders')}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Créer l'Ordre
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
