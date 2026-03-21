import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { planningReportApi, type PlanningReportRow } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, RefreshCw } from 'lucide-react';

const PAGE_SIZE = 100;

const STATUT_OPTIONS = ['Planifié', 'En cours', 'Réalisé', 'Suspendu', 'Cloturé'] as const;

const STATUT_BADGE_CLASS: Record<string, string> = {
  Planifié: 'bg-blue-100 text-blue-800 border-blue-200',
  'En cours': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Réalisé: 'bg-green-100 text-green-800 border-green-200',
  Suspendu: 'bg-red-100 text-red-800 border-red-200',
  Cloturé: 'bg-cyan-100 text-cyan-800 border-cyan-200',
};

function toNum(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function tauxRealisation(row: PlanningReportRow): number {
  const planned = toNum(row.pf_qty) + toNum(row.set_qty) + toNum(row.tester_qty);
  if (planned <= 0) return 0;
  const declared =
    toNum(row.fabrication_Pf_Qty) + toNum(row.fabrication_Set_qty) + toNum(row.fabrication_Tester_qty);
  return Math.round((declared / planned) * 10000) / 100;
}

function tauxBadgeClass(pct: number): string {
  if (pct >= 100) return 'bg-green-100 text-green-800 border-green-200';
  if (pct >= 50) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  if (pct > 0) return 'bg-orange-100 text-orange-800 border-orange-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

export default function PlanningReportPage() {
  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();
  const canAccess = hasMenuAccess('/planning/report');

  const [statusFilter, setStatusFilter] = useState<Record<string, boolean>>({
    Planifié: true,
    'En cours': true,
    Réalisé: false,
    Suspendu: false,
    Cloturé: false,
  });
  const [clientFilter, setClientFilter] = useState<string>('all');

  const { data: rows = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['planning-report'],
    queryFn: () => planningReportApi.getReport(),
    enabled: !!user && canAccess,
  });

  const clientOptions = useMemo(() => {
    const names = new Set<string>();
    rows.forEach((r) => {
      const n = r.client_name?.trim();
      if (n) names.add(n);
    });
    return Array.from(names).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    let list = rows.filter((r) => statusFilter[r.statut] === true);
    if (clientFilter !== 'all') {
      list = list.filter((r) => (r.client_name ?? '').trim() === clientFilter);
    }
    return list;
  }, [rows, statusFilter, clientFilter]);

  const toggleStatus = (statut: string) => {
    setStatusFilter((prev) => ({ ...prev, [statut]: !prev[statut] }));
  };

  if (authLoading || roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }
  if (!user || !canAccess) {
    return <Navigate to="/" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Reporting commande</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            aria-label="Actualiser"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtres</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium mb-2">Statut</p>
            <div className="flex flex-wrap gap-4">
              {STATUT_OPTIONS.map((s) => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={statusFilter[s] === true}
                    onCheckedChange={() => toggleStatus(s)}
                    aria-label={s}
                  />
                  <span className="text-sm">{s}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Filtre par client : utilisez le menu déroulant dans l&apos;en-tête de la colonne Client.
            </p>
          </CardContent>
        </Card>

        {/* Note */}
        <p className="text-sm text-muted-foreground">
          Note : (Déclarée / Plannifiée) — Dans les colonnes de quantités, le premier nombre est la quantité
          déclarée, le second la quantité plannifiée.
        </p>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rapport par commande</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold uppercase">
                        <div className="flex flex-col gap-1">
                          <span>Client</span>
                          <Select value={clientFilter} onValueChange={setClientFilter}>
                            <SelectTrigger className="h-8 w-full max-w-[180px] font-normal">
                              <SelectValue placeholder="Tous les clients" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Tous les clients</SelectItem>
                              {clientOptions.map((name) => (
                                <SelectItem key={name} value={name}>
                                  {name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold uppercase">Commande</TableHead>
                      <TableHead className="font-semibold uppercase text-right">Qté PF</TableHead>
                      <TableHead className="font-semibold uppercase text-right">Qté Set</TableHead>
                      <TableHead className="font-semibold uppercase text-right">Qté Tester</TableHead>
                      <TableHead className="font-semibold uppercase text-center">Taux de réalisation %</TableHead>
                      <TableHead className="font-semibold uppercase text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Aucune donnée pour les filtres sélectionnés.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRows.slice(0, PAGE_SIZE).map((row) => {
                        const taux = tauxRealisation(row);
                        return (
                          <TableRow key={row.sale_order_id}>
                            <TableCell>{row.client_name ?? '—'}</TableCell>
                            <TableCell className="font-mono">{row.sale_order_id}</TableCell>
                            <TableCell className="text-right">
                              <span className="font-semibold">{toNum(row.fabrication_Pf_Qty)}</span>
                              <span className="text-muted-foreground"> / {toNum(row.pf_qty)}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-semibold">{toNum(row.fabrication_Set_qty)}</span>
                              <span className="text-muted-foreground"> / {toNum(row.set_qty)}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-semibold">{toNum(row.fabrication_Tester_qty)}</span>
                              <span className="text-muted-foreground"> / {toNum(row.tester_qty)}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={tauxBadgeClass(taux)}>
                                {taux.toFixed(2)} %
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className={STATUT_BADGE_CLASS[row.statut] ?? 'bg-muted'}
                              >
                                {row.statut}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
                {filteredRows.length > PAGE_SIZE && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Affichage des {PAGE_SIZE} premières lignes sur {filteredRows.length}.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
