import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fabricationApi, type WorkshopDailyRow } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Loader2, RefreshCw, AlertTriangle, List } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';

const PAGE_SIZE = 100;

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'd/M/yyyy HH:mm', { locale: fr }) : '—';
}

function datePart(iso: string | null): string | null {
  if (!iso) return null;
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'yyyy-MM-dd') : null;
}

function durationMinutes(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const s = parseISO(start).getTime();
  const e = parseISO(end).getTime();
  if (e <= s) return 0;
  return Math.round((e - s) / 60000);
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function isAnomaly(row: WorkshopDailyRow): boolean {
  const start = datePart(row.date_fabrication);
  const end = datePart(row.End_Fab_date);
  if (!start || !end) return false;
  return start !== end;
}

export default function DailyFollowUpPage() {
  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();
  const canAccess = hasMenuAccess('/workshop/daily');

  const [filterDate, setFilterDate] = useState<string>('');
  const [filterChaineId, setFilterChaineId] = useState<string>('all');
  const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false);

  const { data: rows = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['workshop-daily'],
    queryFn: () => fabricationApi.getDaily(),
    enabled: !!user && canAccess,
  });

  const chainesOptions = useMemo(() => {
    const seen = new Map<string, { chaine_id: string; label: string }>();
    rows.forEach((r) => {
      if (r.chaine_id && !seen.has(r.chaine_id)) {
        const label = r.num_chaine != null
          ? `Chaîne ${r.num_chaine}${r.chef_name ? ` — ${r.chef_name}` : ''}`
          : (r.chef_name || r.chaine_id);
        seen.set(r.chaine_id, { chaine_id: r.chaine_id, label });
      }
    });
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (filterDate) {
      const target = filterDate;
      list = list.filter((r) => {
        const start = datePart(r.date_fabrication);
        const end = datePart(r.End_Fab_date);
        return start === target && end === target;
      });
    }
    if (filterChaineId !== 'all') {
      list = list.filter((r) => r.chaine_id === filterChaineId);
    }
    if (showAnomaliesOnly) {
      list = list.filter(isAnomaly);
    }
    return list;
  }, [rows, filterDate, filterChaineId, showAnomaliesOnly]);

  const summary = useMemo(() => {
    const totalPf = filteredRows.reduce((s, r) => s + (r.Pf_Qty ?? 0), 0);
    const totalSet = filteredRows.reduce((s, r) => s + (r.Set_qty ?? 0), 0);
    const totalTester = filteredRows.reduce((s, r) => s + (r.Tester_qty ?? 0), 0);
    const totalMinutes = filteredRows.reduce(
      (s, r) => s + durationMinutes(r.date_fabrication, r.End_Fab_date),
      0
    );
    return {
      totalPf,
      totalSet,
      totalTester,
      totalMinutes,
      totalDurationLabel: formatDuration(totalMinutes),
    };
  }, [filteredRows]);

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
          <h1 className="text-2xl font-bold tracking-tight">Suivi de la Fabrication</h1>
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
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="filter-date">
                Filtrer par date
              </label>
              <input
                id="filter-date"
                type="date"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
            <div className="space-y-2 min-w-[200px]">
              <label className="text-sm font-medium" htmlFor="filter-chef">
                Filtrer par chef de chaîne
              </label>
              <Select value={filterChaineId} onValueChange={setFilterChaineId}>
                <SelectTrigger id="filter-chef">
                  <SelectValue placeholder="Tous les chefs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les chefs</SelectItem>
                  {chainesOptions.map((opt) => (
                    <SelectItem key={opt.chaine_id} value={opt.chaine_id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              {!showAnomaliesOnly ? (
                <Button
                  variant="outline"
                  onClick={() => setShowAnomaliesOnly(true)}
                  className="gap-2"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Anomalies
                </Button>
              ) : (
                <Button
                  variant="default"
                  onClick={() => setShowAnomaliesOnly(false)}
                  className="gap-2"
                >
                  <List className="h-4 w-4" />
                  Afficher tout
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Résumé des données filtrées</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Total QTÉ PF</p>
                <p className="text-xl font-semibold">{summary.totalPf}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total QTÉ SET</p>
                <p className="text-xl font-semibold">{summary.totalSet}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total QTÉ TESTEUR</p>
                <p className="text-xl font-semibold">{summary.totalTester}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Temps de fabrication</p>
                <p className="text-xl font-semibold">{summary.totalDurationLabel}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {showAnomaliesOnly ? 'Lignes avec anomalie (date début ≠ date fin)' : 'Liste des fabrications'}
            </CardTitle>
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
                      <TableHead className="font-semibold uppercase">Client</TableHead>
                      <TableHead className="font-semibold uppercase">Commande</TableHead>
                      <TableHead className="font-semibold uppercase">Nom du produit</TableHead>
                      <TableHead className="font-semibold uppercase">Date début fabrication</TableHead>
                      <TableHead className="font-semibold uppercase">Date fin fabrication</TableHead>
                      <TableHead className="font-semibold uppercase text-right">QTÉ PF</TableHead>
                      <TableHead className="font-semibold uppercase text-right">QTÉ SET</TableHead>
                      <TableHead className="font-semibold uppercase text-right">QTÉ TESTEUR</TableHead>
                      <TableHead className="font-semibold uppercase">Temps de fabrication</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          {showAnomaliesOnly
                            ? 'Aucune anomalie pour les filtres sélectionnés.'
                            : 'Aucune donnée pour les filtres sélectionnés.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRows.slice(0, PAGE_SIZE).map((row) => {
                        const anomaly = isAnomaly(row);
                        const mins = durationMinutes(row.date_fabrication, row.End_Fab_date);
                        return (
                          <TableRow
                            key={row.id}
                            className={anomaly ? 'bg-destructive/10 hover:bg-destructive/15' : ''}
                            data-anomaly={anomaly}
                            data-chaine-id={row.chaine_id ?? undefined}
                            data-date-start={datePart(row.date_fabrication) ?? undefined}
                            data-date-end={datePart(row.End_Fab_date) ?? undefined}
                            data-fab-dates={JSON.stringify([{ start: row.date_fabrication, end: row.End_Fab_date }])}
                          >
                            <TableCell>{row.client_name ?? '—'}</TableCell>
                            <TableCell>{row.sale_order_id ?? '—'}</TableCell>
                            <TableCell>{row.product_name ?? '—'}</TableCell>
                            <TableCell>{formatDateTime(row.date_fabrication)}</TableCell>
                            <TableCell>{formatDateTime(row.End_Fab_date)}</TableCell>
                            <TableCell className="text-right">{row.Pf_Qty ?? 0}</TableCell>
                            <TableCell className="text-right">{row.Set_qty ?? 0}</TableCell>
                            <TableCell className="text-right">{row.Tester_qty ?? 0}</TableCell>
                            <TableCell>{formatDuration(mins)}</TableCell>
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
