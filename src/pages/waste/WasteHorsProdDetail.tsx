'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { wasteHorsProdApi, type RebutHorsProdRow } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Lock, Pencil, Trash2, ArrowLeft } from 'lucide-react';

function formatDateTime(d: string | Date | null | undefined) {
  if (!d) return '—';
  const date = new Date(d);
  return isNaN(date.getTime()) ? '—' : format(date, 'dd/MM/yyyy HH:mm', { locale: fr });
}

export default function WasteHorsProdDetail() {
  const navigate = useNavigate();
  const params = useParams();
  const id = params.id ? Number.parseInt(String(params.id), 10) : NaN;

  const { loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();
  const canAccess = hasMenuAccess('/components/waste');

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['waste-hors-prod-detail', id],
    queryFn: async () => {
      if (!Number.isFinite(id)) throw new Error('ID invalide');
      return wasteHorsProdApi.getById(id);
    },
    enabled: !!canAccess && Number.isFinite(id),
    staleTime: 60_000,
  });

  const row = data as RebutHorsProdRow | undefined;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!row) return;
      return wasteHorsProdApi.delete(row.id);
    },
    onSuccess: async () => {
      toast.success('Rebut supprimé.');
      setDeleteId(null);
      navigate('/components/waste');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Erreur suppression'),
  });

  const statusBadge = useMemo(() => {
    if (!row) return null;
    return row.status ? (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Déverrouillé
      </span>
    ) : (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
        Verrouillé
      </span>
    );
  }, [row]);

  if (authLoading || roleLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!canAccess) {
    return (
      <DashboardLayout>
        <div className="p-4 text-destructive">Accès non autorisé.</div>
      </DashboardLayout>
    );
  }

  if (!row) {
    return (
      <DashboardLayout>
        <div className="p-4 text-destructive">Rebut introuvable.</div>
      </DashboardLayout>
    );
  }

  const locked = row.status === false;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 flex justify-center">
        <Card className="w-full max-w-3xl overflow-hidden">
          <div className="bg-gradient-to-r from-[#17a2b8] to-[#138496] px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div className="text-white">
                <div className="text-sm opacity-90">Rebut hors production</div>
                <div className="text-2xl font-bold">#{row.id}</div>
              </div>
              {statusBadge}
            </div>
          </div>

          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold text-[#495057]">Produit</div>
                  <div className="text-lg font-medium text-[#6c757d]">{row.produit}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#495057]">Composant</div>
                  <div className="text-lg font-medium text-[#6c757d]">{row.composant}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs font-semibold text-[#495057]">Quantité</div>
                  <div className="inline-flex items-center px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-semibold">
                    {row.qty}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#495057]">Défaut</div>
                  <div className="mt-1 inline-flex items-center px-3 py-2 rounded bg-yellow-200 text-yellow-900 text-sm font-semibold">
                    {row.defaut}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold text-[#495057]">Demandeur</div>
                  <div className="text-lg text-[#6c757d]">{row.demandeur ?? '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#495057]">Statut</div>
                  <div className="text-lg text-[#6c757d]">{locked ? 'Verrouillé' : 'Déverrouillé'}</div>
                </div>
                {row.updatedBy ? (
                  <div>
                    <div className="text-xs font-semibold text-[#495057]">Modifié par</div>
                    <div className="text-lg text-[#6c757d]">{row.updatedBy}</div>
                  </div>
                ) : null}
                <div>
                  <div className="text-xs font-semibold text-[#495057]">Créé par</div>
                  <div className="text-lg text-[#6c757d]">{row.createdBy ?? '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#495057]">Date de Création</div>
                  <div className="text-lg text-[#6c757d]">{formatDateTime(row.createdAt)}</div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="text-xs font-semibold text-[#495057] mb-2">Commentaire</div>
              {row.comment ? (
                <div className="rounded-md bg-muted/40 px-4 py-3 text-sm text-[#6c757d]">
                  {row.comment}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Aucun commentaire</div>
              )}
            </div>

            <div className="mt-7 flex items-center justify-between gap-3">
              <Button variant="outline" onClick={() => navigate('/components/waste')} className="border-[#d1d3e2] text-muted-foreground">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour à la Liste
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  disabled={locked}
                  onClick={() => navigate(`/components/waste/${row.id}/edit`)}
                  className={locked ? 'opacity-50 cursor-not-allowed' : 'bg-gradient-to-r from-[#ffc107] to-[#e0a800] text-[#212529] hover:shadow-lg'}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Modifier
                </Button>
                <Button
                  disabled={locked}
                  variant="destructive"
                  onClick={() => setDeleteId(row.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer
                </Button>
                {locked ? (
                  <span className="inline-flex items-center text-muted-foreground text-sm gap-2">
                    <Lock className="h-4 w-4" />
                    Verrouillé
                  </span>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
              <AlertDialogDescription>Voulez-vous vraiment supprimer ce rebut ?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteMutation.mutate()}
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

