import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { fabOrdersApi, fabricationApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, CalendarIcon, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const TIME_MIN_MINUTES = 8 * 60 + 0;   // 08:00
const TIME_MAX_MINUTES = 17 * 60 + 25; // 17:25

function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function isTimeInWindow(d: Date): boolean {
  const m = minutesSinceMidnight(d);
  return m >= TIME_MIN_MINUTES && m <= TIME_MAX_MINUTES;
}

const formSchema = z
  .object({
    valid_date: z.date().optional().nullable(),
    date_fabrication: z.date({ required_error: 'Début de production requis' }),
    end_fab_date: z.date({ required_error: 'Fin de production requise' }),
    lot_jus: z.string().min(1, 'Lot de jus requis'),
    effectif_reel: z.coerce.number().min(0).optional(),
    pf_qty: z.coerce.number().min(0).default(0),
    sf_qty: z.coerce.number().min(0).default(0),
    set_qty: z.coerce.number().min(0).default(0),
    tester_qty: z.coerce.number().min(0).default(0),
    comment_chaine: z.string().optional(),
  })
  .refine(
    (data) => {
      if (!data.date_fabrication || !data.end_fab_date) return true;
      return data.date_fabrication.getTime() < data.end_fab_date.getTime();
    },
    { message: 'Début de Production doit être antérieur à Fin de Production', path: ['end_fab_date'] }
  )
  .refine(
    (data) => {
      if (!data.date_fabrication) return true;
      return isTimeInWindow(data.date_fabrication);
    },
    { message: 'L\'heure du Début de Production doit être entre 08:00 et 17:25', path: ['date_fabrication'] }
  )
  .refine(
    (data) => {
      if (!data.end_fab_date) return true;
      return isTimeInWindow(data.end_fab_date);
    },
    { message: 'L\'heure de Fin de Production doit être entre 08:00 et 17:25', path: ['end_fab_date'] }
  );

type FormValues = z.infer<typeof formSchema>;

export default function DeclarationAddPage() {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();

  const canAccess = hasMenuAccess('/workshop/declaration');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      valid_date: undefined,
      date_fabrication: undefined,
      end_fab_date: undefined,
      lot_jus: '',
      effectif_reel: undefined,
      pf_qty: 0,
      sf_qty: 0,
      set_qty: 0,
      tester_qty: 0,
      comment_chaine: '',
    },
  });

  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ['fab-order', orderId],
    queryFn: () => fabOrdersApi.getById(orderId!),
    enabled: !!user && !!orderId,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      await fabricationApi.create({
        OFID: order!.of_id,
        Lot_Jus: values.lot_jus,
        Valid_date: values.valid_date ? format(values.valid_date, 'yyyy-MM-dd HH:mm:ss') : undefined,
        effectif_Reel: values.effectif_reel,
        date_fabrication: values.date_fabrication ? format(values.date_fabrication, 'yyyy-MM-dd HH:mm:ss') : undefined,
        End_Fab_date: values.end_fab_date ? format(values.end_fab_date, 'yyyy-MM-dd HH:mm:ss') : undefined,
        Pf_Qty: values.pf_qty,
        Sf_Qty: values.sf_qty,
        Set_qty: values.set_qty,
        Tester_qty: values.tester_qty,
        Comment_chaine: values.comment_chaine,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fab-orders-declaration'] });
      queryClient.invalidateQueries({ queryKey: ['fab-orders'] }); // so atelier/fab-orders shows updated "En cours"
      toast({ title: 'Déclaration enregistrée avec succès' });
      navigate('/workshop/declaration');
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const onSubmit = (values: FormValues) => {
    saveMutation.mutate(values);
  };

  const onInvalid = () => {
    toast({
      title: 'Validation',
      description: 'Vérifiez les champs : Début/Fin de Production (entre 08:00 et 17:25, Début < Fin), Lot de Jus.',
      variant: 'destructive',
    });
  };

  const hasInstruction = !!order?.instruction?.trim();
  const hasLotSet = !!order?.lot_set?.trim();
  const hasComment = !!order?.comment?.trim();
  const warningClass = 'border-amber-500/60 bg-amber-50/80 dark:bg-amber-950/30';

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
    return <Navigate to="/auth" replace />;
  }

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  if (!orderId) {
    return <Navigate to="/workshop/declaration" replace />;
  }

  if (orderLoading || !order) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/workshop/declaration')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <h1 className="text-3xl font-bold">
              Déclaration de production OF: {order.of_id}
            </h1>
          </div>
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </div>

        {/* Order summary card: data from fabOrder (client, product, instruction, lot_set, comment, quantities) */}
        <Card>
          <CardHeader>
            <CardTitle>Résumé de l'ordre </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div className="rounded-md border p-3">
                <span className="font-semibold text-muted-foreground">CLIENT</span>
                <p className="font-medium mt-1">{order.client_name ?? order.client_id ?? '-'}</p>
              </div>
              <div className="rounded-md border p-3">
                <span className="font-semibold text-muted-foreground">PRODUIT</span>
                <p className="font-medium mt-1">{order.product_name ?? order.prod_name ?? '-'}</p>
              </div>
              <div className={cn('rounded-md border p-3 flex items-start gap-2', hasInstruction && warningClass)}>
                {hasInstruction && <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />}
                <div>
                  <span className="font-semibold text-muted-foreground">INSTRUCTIONS</span>
                  <p className="font-medium mt-1">{order.instruction?.trim() || 'N/A'}</p>
                </div>
              </div>
              <div className={cn('rounded-md border p-3 flex items-start gap-2', hasLotSet && warningClass)}>
                {hasLotSet && <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />}
                <div>
                  <span className="font-semibold text-muted-foreground">LOT SET</span>
                  <p className="font-medium mt-1">{order.lot_set?.trim() || 'N/A'}</p>
                </div>
              </div>
              <div className={cn('rounded-md border p-3 flex items-start gap-2', hasComment && warningClass)}>
                {hasComment && <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />}
                <div>
                  <span className="font-semibold text-muted-foreground">COMMENTAIRE</span>
                  <p className="font-medium mt-1">{order.comment?.trim() || 'N/A'}</p>
                </div>
              </div>
              <div className="rounded-md border p-3 flex items-center gap-2">
                <span className="font-semibold text-muted-foreground">PF</span>
                <Badge variant="default">{order.pf_qty ?? 0}</Badge>
              </div>
              <div className="rounded-md border p-3 flex items-center gap-2">
                <span className="font-semibold text-muted-foreground">TESTEUR</span>
                <Badge variant="default">{order.tester_qty ?? 0}</Badge>
              </div>
              <div className="rounded-md border p-3 flex items-center gap-2">
                <span className="font-semibold text-muted-foreground">SET</span>
                <Badge variant="default">{order.set_qty ?? 0}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form: fabrication.store – prefilled from fabOrder */}
        <Card>
          <CardHeader>
            <CardTitle>Déclaration (fabrication)</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="valid_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Date de Validité</FormLabel>
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
                                  <span>jj/mm/aaaa</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value || undefined}
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
                    name="date_fabrication"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Début de Production *</FormLabel>
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
                                  format(field.value, 'dd/MM/yyyy HH:mm', { locale: fr })
                                ) : (
                                  <span>jj/mm/aaaa --:--</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ? new Date(field.value.getFullYear(), field.value.getMonth(), field.value.getDate()) : undefined}
                              onSelect={(date) => {
                                if (!date) return;
                                const prev = field.value;
                                const hours = prev?.getHours() ?? 0;
                                const minutes = prev?.getMinutes() ?? 0;
                                field.onChange(new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes));
                              }}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                            <div className="border-t px-3 pb-3 pt-2">
                              <Input
                                type="time"
                                value={field.value ? format(field.value, 'HH:mm') : '00:00'}
                                onChange={(e) => {
                                  const [h, m] = (e.target.value || '00:00').split(':').map(Number);
                                  const base = field.value ? new Date(field.value) : new Date();
                                  base.setHours(h, m ?? 0, 0, 0);
                                  field.onChange(base);
                                }}
                                className="w-full"
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="end_fab_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Fin de Production *</FormLabel>
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
                                  format(field.value, 'dd/MM/yyyy HH:mm', { locale: fr })
                                ) : (
                                  <span>jj/mm/aaaa --:--</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ? new Date(field.value.getFullYear(), field.value.getMonth(), field.value.getDate()) : undefined}
                              onSelect={(date) => {
                                if (!date) return;
                                const prev = field.value;
                                const hours = prev?.getHours() ?? 0;
                                const minutes = prev?.getMinutes() ?? 0;
                                field.onChange(new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes));
                              }}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                            <div className="border-t px-3 pb-3 pt-2">
                              <Input
                                type="time"
                                value={field.value ? format(field.value, 'HH:mm') : '00:00'}
                                onChange={(e) => {
                                  const [h, m] = (e.target.value || '00:00').split(':').map(Number);
                                  const base = field.value ? new Date(field.value) : new Date();
                                  base.setHours(h, m ?? 0, 0, 0);
                                  field.onChange(base);
                                }}
                                className="w-full"
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <FormField
                    control={form.control}
                    name="lot_jus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lot de Jus (Lot_Jus) *</FormLabel>
                        <FormControl>
                          <Input placeholder="Entrez le numéro du lot" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="effectif_reel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Effectif Réel</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} placeholder="Nombre d'employés" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pf_qty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantité PF</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} placeholder="Quantité PF" {...field} />
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
                        <FormLabel>Quantité Set</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} placeholder="Quantité Set" {...field} />
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
                        <FormLabel>Quantité Tester</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} placeholder="Quantité Testeur" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="comment_chaine"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commentaire chaîne</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Entrez vos commentaires ou notes concernant la production..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
