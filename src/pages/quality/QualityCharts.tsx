import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Navigate } from 'react-router-dom';
import { qualityApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

export default function QualityChartsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading, hasMenuAccess } = useUserRole();

  const canAccess = hasMenuAccess('/quality/charts');

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterApplied, setFilterApplied] = useState(true);

  const startParam = filterApplied ? `${startDate}T00:00:00` : undefined;
  const endParam = filterApplied ? `${endDate}T23:59:59` : undefined;

  const { data: anomaliesData, isLoading: anomaliesLoading } = useQuery({
    queryKey: ['quality-charts-anomalies', startParam, endParam],
    queryFn: () => qualityApi.getChartsAnomalies(startParam, endParam),
    enabled: !!user && canAccess && filterApplied,
  });

  const { data: conformityData, isLoading: conformityLoading } = useQuery({
    queryKey: ['quality-charts-conformity', startParam, endParam],
    queryFn: () => qualityApi.getChartsConformity(startParam, endParam),
    enabled: !!user && canAccess && filterApplied,
  });

  const anomaliesChartData = (anomaliesData || []).map((a) => ({
    name: a.label || a.id,
    total: a.total,
    nc: a.total,
  }));

  const conformityChartData = (conformityData || []).map((c) => ({
    date: c.date,
    total_nc: c.total_nc,
    of_count: c.of_count,
  }));

  if (authLoading || roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!canAccess) return <Navigate to="/" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/workshop/defects">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Graphiques qualité</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base uppercase tracking-wide">Filtre par période</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <Label>Date début</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Date fin</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <Button onClick={() => setFilterApplied(true)}>Filtrer</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base uppercase tracking-wide">Anomalies</CardTitle>
            </CardHeader>
            <CardContent>
              {anomaliesLoading ? (
                <div className="flex justify-center h-64 items-center">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : anomaliesChartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Aucune donnée sur la période
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={anomaliesChartData} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={80} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total" name="Qté NC" fill="hsl(var(--chart-1))" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base uppercase tracking-wide">Conformité (NC dans le temps)</CardTitle>
            </CardHeader>
            <CardContent>
              {conformityLoading ? (
                <div className="flex justify-center h-64 items-center">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : conformityChartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Aucune donnée sur la période
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={conformityChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="total_nc"
                      name="Total NC"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="of_count"
                      name="Nb OF"
                      stroke="hsl(var(--chart-3))"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
