import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { auditLogsApi } from '@/lib/api';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { TableColumnPicker } from '@/components/ui/table-column-picker';
import {
  useTableColumnVisibility,
  countVisibleTableColumns,
  type TableColumnDef,
} from '@/hooks/use-table-column-visibility';
import {
  Activity, Search, RefreshCw, ChevronLeft, ChevronRight,
  Eye, Loader2, X,
} from 'lucide-react';

interface AuditLog {
  id: number;
  user_id: string | null;
  user_email: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  table_name: string;
  record_id: string | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  endpoint: string | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  CREATE: 'default',
  UPDATE: 'secondary',
  DELETE: 'destructive',
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
};

const PAGE_SIZE = 50;

const AUDIT_LOGS_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'created_at', label: 'Date / Heure' },
  { id: 'user', label: 'Utilisateur' },
  { id: 'action', label: 'Action' },
  { id: 'module', label: 'Module' },
  { id: 'record_id', label: 'ID enregistrement' },
  { id: 'ip', label: 'Adresse IP' },
  { id: 'details', label: 'Détails', required: true },
];

export default function AuditLogsPage() {
  const { user, loading: authLoading } = useAuth();
  const { role, hasMenuAccess, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [logs, setLogs]       = useState<AuditLog[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [tables, setTables]   = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Filters
  const [search,    setSearch]    = useState('');
  const [action,    setAction]    = useState('');
  const [tableName, setTableName] = useState('');
  const [dateFrom,  setDateFrom]  = useState('');
  const [dateTo,    setDateTo]    = useState('');

  const { isVisible, toggle, reset, optionalColumns, visibility } = useTableColumnVisibility(
    'admin-audit-logs',
    AUDIT_LOGS_TABLE_COLUMNS
  );
  const auditColSpan = countVisibleTableColumns(AUDIT_LOGS_TABLE_COLUMNS, visibility, 0);

  const fetchLogs = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const res = await auditLogsApi.getAll({
        page: p,
        limit: PAGE_SIZE,
        action:     action     || undefined,
        table_name: tableName  || undefined,
        search:     search     || undefined,
        date_from:  dateFrom   || undefined,
        date_to:    dateTo     || undefined,
      });
      setLogs(res.data);
      setTotal(res.total);
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de charger les logs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [page, action, tableName, search, dateFrom, dateTo]);

  const fetchTables = async () => {
    try {
      const t = await auditLogsApi.getTables();
      setTables(t);
    } catch { /* silent */ }
  };

  useEffect(() => {
    if (user) {
      fetchTables();
      fetchLogs(1);
      setPage(1);
    }
  }, [user, action, tableName, dateFrom, dateTo]);

  useEffect(() => {
    if (user) fetchLogs(page);
  }, [page]);

  const handleSearch = () => { setPage(1); fetchLogs(1); };

  const clearFilters = () => {
    setSearch(''); setAction(''); setTableName('');
    setDateFrom(''); setDateTo('');
    setPage(1);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (authLoading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!hasMenuAccess('/admin/audit-logs')) return <Navigate to="/" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Activity className="h-6 w-6" />
              Journal d'activité
            </h2>
            <p className="text-muted-foreground">
              Historique de toutes les opérations CRUD effectuées dans le système
            </p>
          </div>
          <Button variant="outline" onClick={() => fetchLogs(page)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualiser
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtres</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              {/* Search by email */}
              <div className="flex gap-2 xl:col-span-2">
                <Input
                  placeholder="Rechercher par email..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <Button size="icon" variant="secondary" onClick={handleSearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              {/* Action */}
              <Select value={action} onValueChange={v => { setAction(v === 'ALL' ? '' : v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes les actions</SelectItem>
                  <SelectItem value="CREATE">Création</SelectItem>
                  <SelectItem value="UPDATE">Modification</SelectItem>
                  <SelectItem value="DELETE">Suppression</SelectItem>
                </SelectContent>
              </Select>

              {/* Table */}
              <Select value={tableName} onValueChange={v => { setTableName(v === 'ALL' ? '' : v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les modules</SelectItem>
                  {tables.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date from */}
              <Input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                placeholder="Date début"
              />

              {/* Date to + clear */}
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setPage(1); }}
                  placeholder="Date fin"
                />
                {(search || action || tableName || dateFrom || dateTo) && (
                  <Button size="icon" variant="ghost" onClick={clearFilters} title="Effacer les filtres">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                Logs
              </CardTitle>
              <CardDescription>
                {total} entrée{total !== 1 ? 's' : ''} trouvée{total !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <TableColumnPicker
              optionalColumns={optionalColumns}
              visibility={visibility}
              onToggle={toggle}
              onReset={reset}
            />
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {isVisible('created_at') && <TableHead>Date / Heure</TableHead>}
                    {isVisible('user') && <TableHead>Utilisateur</TableHead>}
                    {isVisible('action') && <TableHead>Action</TableHead>}
                    {isVisible('module') && <TableHead>Module</TableHead>}
                    {isVisible('record_id') && <TableHead>ID enregistrement</TableHead>}
                    {isVisible('ip') && <TableHead>Adresse IP</TableHead>}
                    {isVisible('details') && <TableHead className="text-right">Détails</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      {isVisible('created_at') && (
                        <TableCell className="whitespace-nowrap text-sm">
                          {new Date(log.created_at).toLocaleString('fr-FR')}
                        </TableCell>
                      )}
                      {isVisible('user') && (
                        <TableCell className="text-sm">
                          {log.user_email ?? <span className="text-muted-foreground italic">Inconnu</span>}
                        </TableCell>
                      )}
                      {isVisible('action') && (
                        <TableCell>
                          <Badge variant={ACTION_COLORS[log.action] ?? 'outline'}>
                            {ACTION_LABELS[log.action] ?? log.action}
                          </Badge>
                        </TableCell>
                      )}
                      {isVisible('module') && (
                        <TableCell>
                          <code className="rounded bg-muted px-1 py-0.5 text-xs">{log.table_name}</code>
                        </TableCell>
                      )}
                      {isVisible('record_id') && (
                        <TableCell className="text-sm text-muted-foreground">{log.record_id ?? '-'}</TableCell>
                      )}
                      {isVisible('ip') && (
                        <TableCell className="text-sm text-muted-foreground">{log.ip_address ?? '-'}</TableCell>
                      )}
                      {isVisible('details') && (
                        <TableCell className="text-right">
                          {log.new_data && (
                            <Button variant="ghost" size="icon" onClick={() => setSelectedLog(log)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={Math.max(auditColSpan, 1)}
                        className="py-12 text-center text-muted-foreground"
                      >
                        Aucune entrée trouvée
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Page {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Suivant
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={open => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails de l'opération</DialogTitle>
            <DialogDescription>
              {selectedLog && new Date(selectedLog.created_at).toLocaleString('fr-FR')}
              {selectedLog?.endpoint && (
                <span className="ml-2 font-mono text-xs">{selectedLog.endpoint}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedLog?.new_data && (
            <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs">
              {JSON.stringify(selectedLog.new_data, null, 2)}
            </pre>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
