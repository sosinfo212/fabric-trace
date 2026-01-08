import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, CalendarIcon } from 'lucide-react';
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
  sf_qty: z.coerce.number().min(0).default(0),
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
  const { role, loading: roleLoading, hasAccess } = useUserRole();

  const canAccess = hasAccess(['admin', 'chef_chaine', 'chef_de_chaine', 'controle']);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      of_id: '',
      prod_ref: '',
      prod_name: '',
      sale_order_id: '',
      lot_set: '',
      pf_qty: 0,
      sf_qty: 0,
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
      const { data, error } = await supabase
        .from('chaines')
        .select('id, num_chaine')
        .order('num_chaine');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, designation')
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, ref_id, product_name')
        .order('product_name');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { error } = await supabase.from('fab_orders').insert({
        of_id: values.of_id,
        product_id: values.product_id || null,
        prod_ref: values.prod_ref || null,
        prod_name: values.prod_name || null,
        chaine_id: values.chaine_id,
        sale_order_id: values.sale_order_id,
        client_id: values.client_id,
        date_fabrication: values.date_fabrication?.toISOString() || null,
        pf_qty: values.pf_qty,
        sf_qty: values.sf_qty,
        set_qty: values.set_qty,
        tester_qty: values.tester_qty,
        lot_set: values.lot_set,
        instruction: values.instruction || null,
        comment: values.comment || null,
        statut_of: values.statut_of,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Ordre créé avec succès' });
      navigate('/atelier/fab-orders');
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Auto-fill product info when product is selected
  const handleProductChange = (productId: string) => {
    form.setValue('product_id', productId);
    const product = products?.find((p) => p.id === productId);
    if (product) {
      form.setValue('prod_ref', product.ref_id);
      form.setValue('prod_name', product.product_name);
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
          <Button variant="ghost" onClick={() => navigate('/atelier/fab-orders')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
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
                          <Input placeholder="CMD-001" {...field} />
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un client" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clients?.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.designation || client.name}
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
                    name="chaine_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chaîne *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner une chaîne" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {chaines?.map((chaine) => (
                              <SelectItem key={chaine.id} value={chaine.id}>
                                Chaîne {chaine.num_chaine}
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
                    name="product_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Produit</FormLabel>
                        <Select onValueChange={handleProductChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un produit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {products?.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.product_name} ({product.ref_id})
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
                    name="prod_ref"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Référence Produit</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="prod_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom Produit</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                    name="sf_qty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SF Qty</FormLabel>
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
                </div>

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

                <FormField
                  control={form.control}
                  name="instruction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instructions</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} />
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
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-4">
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
