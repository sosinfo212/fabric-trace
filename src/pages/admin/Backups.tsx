import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { backupsApi } from '@/lib/api';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Database, 
  Download, 
  Loader2, 
  FileDown, 
  Clock, 
  HardDrive,
  CheckCircle2
} from 'lucide-react';

interface BackupHistory {
  id: string;
  date: Date;
  tables: string[];
  size: string;
}

const AVAILABLE_TABLES = [
  { name: 'profiles', label: 'Profils utilisateurs', description: 'Informations des utilisateurs' },
  { name: 'user_roles', label: 'Rôles utilisateurs', description: 'Attribution des rôles' },
  { name: 'custom_roles', label: 'Rôles personnalisés', description: 'Définition des rôles' },
  { name: 'role_permissions', label: 'Permissions', description: 'Permissions par rôle' },
];

export default function BackupsPage() {
  const { user, loading: authLoading } = useAuth();
  const { role, hasMenuAccess, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [selectedTables, setSelectedTables] = useState<string[]>(
    AVAILABLE_TABLES.map((t) => t.name)
  );
  const [exporting, setExporting] = useState(false);
  const [backupHistory, setBackupHistory] = useState<BackupHistory[]>([]);

  const handleTableToggle = (tableName: string, checked: boolean) => {
    if (checked) {
      setSelectedTables((prev) => [...prev, tableName]);
    } else {
      setSelectedTables((prev) => prev.filter((t) => t !== tableName));
    }
  };

  const handleSelectAll = () => {
    setSelectedTables(AVAILABLE_TABLES.map((t) => t.name));
  };

  const handleDeselectAll = () => {
    setSelectedTables([]);
  };

  const handleExport = async () => {
    if (selectedTables.length === 0) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner au moins une table',
        variant: 'destructive',
      });
      return;
    }

    try {
      setExporting(true);

      const sql = await backupsApi.export(selectedTables);

      // Create and download file
      const blob = new Blob([sql], { type: 'text/sql' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${new Date().toISOString().split('T')[0]}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Add to history
      const newBackup: BackupHistory = {
        id: crypto.randomUUID(),
        date: new Date(),
        tables: selectedTables,
        size: `${(blob.size / 1024).toFixed(2)} KB`,
      };
      setBackupHistory((prev) => [newBackup, ...prev.slice(0, 9)]);

      toast({
        title: 'Succès',
        description: 'Export téléchargé avec succès',
      });
    } catch (error: any) {
      console.error('Error exporting database:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible d\'exporter la base de données',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

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

  if (!hasMenuAccess('/admin/backups')) {
    return <Navigate to="/" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sauvegardes</h2>
          <p className="text-muted-foreground">
            Exportez les données de la base de données
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Export SQL
              </CardTitle>
              <CardDescription>
                Sélectionnez les tables à exporter
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  Tout sélectionner
                </Button>
                <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                  Tout désélectionner
                </Button>
              </div>

              <div className="space-y-4">
                {AVAILABLE_TABLES.map((table) => (
                  <div
                    key={table.name}
                    className="flex items-start space-x-3 rounded-lg border p-4"
                  >
                    <Checkbox
                      id={table.name}
                      checked={selectedTables.includes(table.name)}
                      onCheckedChange={(checked) =>
                        handleTableToggle(table.name, checked as boolean)
                      }
                    />
                    <div className="space-y-1">
                      <Label
                        htmlFor={table.name}
                        className="font-medium cursor-pointer"
                      >
                        {table.label}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {table.description}
                      </p>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {table.name}
                      </code>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleExport}
                disabled={exporting || selectedTables.length === 0}
                className="w-full"
              >
                {exporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Export en cours...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Exporter ({selectedTables.length} table{selectedTables.length > 1 ? 's' : ''})
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Historique des exports
                </CardTitle>
                <CardDescription>
                  Exports récents de cette session
                </CardDescription>
              </CardHeader>
              <CardContent>
                {backupHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aucun export effectué</p>
                    <p className="text-sm">Les exports apparaîtront ici</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {backupHistory.map((backup) => (
                      <div
                        key={backup.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          <div>
                            <p className="text-sm font-medium">
                              {backup.date.toLocaleString('fr-FR')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {backup.tables.length} table{backup.tables.length > 1 ? 's' : ''} • {backup.size}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Informations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Format d'export</p>
                  <p className="text-sm text-muted-foreground">
                    SQL (INSERT statements)
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Contenu</p>
                  <p className="text-sm text-muted-foreground">
                    Les données sont exportées sous forme de commandes INSERT SQL 
                    compatibles avec PostgreSQL.
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Restauration</p>
                  <p className="text-sm text-muted-foreground">
                    Pour restaurer, exécutez le fichier SQL dans votre console 
                    PostgreSQL ou utilisez un outil d'administration.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
