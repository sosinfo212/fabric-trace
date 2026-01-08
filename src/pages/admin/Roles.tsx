import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { AppRole, ROLE_LABELS } from '@/types/roles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Shield, Users, Loader2 } from 'lucide-react';

interface RoleWithUsers {
  role: AppRole;
  label: string;
  description: string;
  users: { id: string; email: string | null; full_name: string | null }[];
}

const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  admin: 'Accès complet à toutes les fonctionnalités du système',
  planificatrice: 'Gestion du planning, commandes et déclarations',
  responsable_magasin_pf: 'Gestion des produits finis et expédition',
  controle: 'Suivi de production et contrôle qualité',
  chef_de_chaine: 'Gestion de la chaîne de production',
  agent_qualite: 'Déclaration des défauts et contrôle qualité',
  chef_equipe_serigraphie: 'Gestion de l\'équipe sérigraphie',
  responsable_magasin: 'Gestion du magasin et stocks',
  chef_equipe_injection: 'Gestion de l\'équipe injection',
  chef_equipe_pf: 'Gestion de l\'équipe produits finis',
  agent_logistique: 'Gestion des transferts et mouvements',
  agent_magasin: 'Opérations magasin et transferts',
  responsable_transport: 'Gestion du transport et expédition',
  operator: 'Accès limité aux fonctionnalités de base',
};

const ALL_ROLES: AppRole[] = [
  'admin',
  'planificatrice',
  'responsable_magasin_pf',
  'controle',
  'chef_de_chaine',
  'agent_qualite',
  'chef_equipe_serigraphie',
  'responsable_magasin',
  'chef_equipe_injection',
  'chef_equipe_pf',
  'agent_logistique',
  'agent_magasin',
  'responsable_transport',
  'operator',
];

export default function RolesPage() {
  const { user, loading: authLoading } = useAuth();
  const { role, hasAccess, loading: roleLoading } = useUserRole();

  const [rolesWithUsers, setRolesWithUsers] = useState<RoleWithUsers[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRolesWithUsers = async () => {
    setLoading(true);
    try {
      // Fetch all user roles with profile info
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name');

      if (profilesError) throw profilesError;

      // Group users by role
      const rolesMap: Record<string, { id: string; email: string | null; full_name: string | null }[]> = {};

      ALL_ROLES.forEach((r) => {
        rolesMap[r] = [];
      });

      userRoles?.forEach((ur) => {
        const profile = profiles?.find((p) => p.id === ur.user_id);
        if (profile && rolesMap[ur.role]) {
          rolesMap[ur.role].push({
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
          });
        }
      });

      const result: RoleWithUsers[] = ALL_ROLES.map((r) => ({
        role: r,
        label: ROLE_LABELS[r],
        description: ROLE_DESCRIPTIONS[r],
        users: rolesMap[r] || [],
      }));

      setRolesWithUsers(result);
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && role === 'admin') {
      fetchRolesWithUsers();
    }
  }, [user, role]);

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

  if (!hasAccess(['admin'])) {
    return <Navigate to="/" replace />;
  }

  const totalUsers = rolesWithUsers.reduce((acc, r) => acc + r.users.length, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Rôles</h2>
          <p className="text-muted-foreground">
            Gérez les rôles et leurs permissions
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Rôles</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{ALL_ROLES.length}</div>
              <p className="text-xs text-muted-foreground">Rôles disponibles</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilisateurs</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
              <p className="text-xs text-muted-foreground">Utilisateurs assignés</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Administrateurs</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {rolesWithUsers.find((r) => r.role === 'admin')?.users.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">Avec accès complet</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Liste des Rôles
            </CardTitle>
            <CardDescription>
              Tous les rôles disponibles dans le système
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {rolesWithUsers.map((roleData) => (
                  <AccordionItem key={roleData.role} value={roleData.role}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-4">
                        <Badge variant={roleData.role === 'admin' ? 'default' : 'secondary'}>
                          {roleData.label}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {roleData.users.length} utilisateur{roleData.users.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        <p className="text-sm text-muted-foreground">
                          {roleData.description}
                        </p>
                        
                        {roleData.users.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Email</TableHead>
                                <TableHead>Nom</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {roleData.users.map((u) => (
                                <TableRow key={u.id}>
                                  <TableCell className="font-medium">{u.email}</TableCell>
                                  <TableCell>{u.full_name || '-'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">
                            Aucun utilisateur avec ce rôle
                          </p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
