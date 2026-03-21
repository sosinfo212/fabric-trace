import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { TransfertTable } from '@/components/transfer/TransfertTable';
import { transfertApi } from '@/lib/api';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, RefreshCw, Package, Loader2, Filter, Search, Settings2, ChevronDown } from 'lucide-react';

const SEARCH_COLUMNS: Record<string, string> = {
  numComm: 'Commande',
  client: 'Client',
  product: 'Produit',
  numPal: 'N° Palette',
  mouvement: 'Mouvement',
  statut: 'Statut',
  comment: 'Commentaire',
};

const MOUVEMENT_OPTIONS = ['A->M', 'M->A'] as const;
const STATUT_OPTIONS = ['Envoyé', 'Récéptionné', 'Annulé'] as const;

export default function MovementsPage() {
  const [statusMap, setStatusMap] = useState<Record<number, string>>({});
  const [searchByColumn, setSearchByColumn] = useState<Record<string, string>>({});
  const [searchInColumns, setSearchInColumns] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    Object.keys(SEARCH_COLUMNS).forEach((k) => (o[k] = true));
    return o;
  });

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['transfert-today'],
    queryFn: async () => {
      const res = await transfertApi.getToday();
      return res.data;
    },
  });

  const transferts = data ?? [];
  const todayLabel = format(new Date(), 'dd/MM/yyyy', { locale: fr });

  const activeSearchKeys = useMemo(
    () => Object.keys(SEARCH_COLUMNS).filter((k) => searchInColumns[k]),
    [searchInColumns]
  );

  const filteredTransferts = useMemo(() => {
    let list = transferts;
    if (activeSearchKeys.length === 0) return list;
    const criteria = activeSearchKeys
      .map((key) => {
        const val = searchByColumn[key]?.trim();
        return val ? { key, val } : null;
      })
      .filter(Boolean) as { key: string; val: string }[];
    if (criteria.length === 0) return list;
    return list.filter((t) =>
      criteria.every(({ key, val }) => {
        if (key === 'mouvement') {
          const selected = val.split(',').map((s) => s.trim()).filter(Boolean);
          return selected.length > 0 && selected.includes(t.mouvement ?? '');
        }
        if (key === 'statut') {
          const selected = val.split(',').map((s) => s.trim()).filter(Boolean);
          return selected.length > 0 && selected.includes(t.statut ?? '');
        }
        const cell = (t as Record<string, unknown>)[key];
        if (cell == null) return false;
        return String(cell).toLowerCase().includes(val.toLowerCase());
      })
    );
  }, [transferts, searchByColumn, activeSearchKeys]);

  const onStatusChange = useCallback((id: number, statut: string) => {
    setStatusMap((prev) => (prev[id] === statut ? prev : { ...prev, [id]: statut }));
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Transfert Atelier vers Magasin</h2>
            <p className="text-muted-foreground">
              Mouvements des produits finis entre atelier et magasin — Données du {todayLabel}
            </p>
          </div>
          <Button asChild>
            <Link to="/transfer/movements/create">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau transfert
            </Link>
          </Button>
        </div>

        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Filtres</CardTitle>
                {(() => {
                  const activeCount = activeSearchKeys.filter(
                    (k) => (searchByColumn[k] ?? '').trim() !== ''
                  ).length;
                  if (activeCount > 0) {
                    return (
                      <span className="text-xs text-muted-foreground">
                        ({activeCount} actif{activeCount > 1 ? 's' : ''})
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                      <Settings2 className="h-3.5 w-3.5" />
                      Colonnes
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-3" align="end">
                    <p className="text-sm font-medium mb-2">Colonnes à afficher dans les filtres</p>
                    <div className="space-y-2">
                      {Object.entries(SEARCH_COLUMNS).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={searchInColumns[key] === true}
                            onCheckedChange={(checked) =>
                              setSearchInColumns((prev) => ({ ...prev, [key]: !!checked }))
                            }
                          />
                          <span className="text-sm">{label}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                {activeSearchKeys.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setSearchByColumn((prev) => {
                        const next = { ...prev };
                        activeSearchKeys.forEach((k) => (next[k] = ''));
                        return next;
                      });
                    }}
                  >
                    Effacer les filtres
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
              {activeSearchKeys.map((key) => (
                <div key={key} className="flex flex-col gap-1.5 min-w-0">
                  <Label className="text-xs text-muted-foreground truncate">
                    {SEARCH_COLUMNS[key]}
                  </Label>
                  {key === 'mouvement' ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 text-left"
                        >
                          <span className="truncate">
                            {(() => {
                              const v = searchByColumn[key] ?? '';
                              const arr = v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];
                              if (arr.length === 0) return 'Sélectionner...';
                              if (arr.length <= 2) return arr.join(', ');
                              return `${arr.length} sélectionné(s)`;
                            })()}
                          </span>
                          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-0" align="start" sideOffset={4}>
                        <div className="p-2 border-b">
                          <p className="text-sm font-medium">Mouvement</p>
                          <p className="text-xs text-muted-foreground">Choix multiples</p>
                        </div>
                        <div className="p-2 max-h-[240px] overflow-auto">
                          {MOUVEMENT_OPTIONS.map((s) => {
                            const v = searchByColumn[key] ?? '';
                            const selected = v ? v.split(',').map((x) => x.trim()).filter(Boolean) : [];
                            const checked = selected.includes(s);
                            return (
                              <label
                                key={s}
                                className="flex items-center gap-2 cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(c) => {
                                    const next = c
                                      ? [...selected, s]
                                      : selected.filter((x) => x !== s);
                                    setSearchByColumn((prev) => ({
                                      ...prev,
                                      [key]: next.join(','),
                                    }));
                                  }}
                                />
                                <span>{s}</span>
                              </label>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : key === 'statut' ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 text-left"
                        >
                          <span className="truncate">
                            {(() => {
                              const v = searchByColumn[key] ?? '';
                              const arr = v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];
                              if (arr.length === 0) return 'Sélectionner...';
                              if (arr.length <= 2) return arr.join(', ');
                              return `${arr.length} sélectionné(s)`;
                            })()}
                          </span>
                          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-0" align="start" sideOffset={4}>
                        <div className="p-2 border-b">
                          <p className="text-sm font-medium">Statut</p>
                          <p className="text-xs text-muted-foreground">Choix multiples</p>
                        </div>
                        <div className="p-2 max-h-[240px] overflow-auto">
                          {STATUT_OPTIONS.map((s) => {
                            const v = searchByColumn[key] ?? '';
                            const selected = v ? v.split(',').map((x) => x.trim()).filter(Boolean) : [];
                            const checked = selected.includes(s);
                            return (
                              <label
                                key={s}
                                className="flex items-center gap-2 cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(c) => {
                                    const next = c
                                      ? [...selected, s]
                                      : selected.filter((x) => x !== s);
                                    setSearchByColumn((prev) => ({
                                      ...prev,
                                      [key]: next.join(','),
                                    }));
                                  }}
                                />
                                <span>{s}</span>
                              </label>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <Input
                        placeholder={SEARCH_COLUMNS[key]}
                        value={searchByColumn[key] ?? ''}
                        onChange={(e) =>
                          setSearchByColumn((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="h-9 w-full min-w-0 pl-8"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {activeSearchKeys.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">
                Cliquez sur « Colonnes » pour choisir les champs à filtrer.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Liste des transferts
                </CardTitle>
                <CardDescription>
                  {filteredTransferts.length} transfert{filteredTransferts.length !== 1 ? 's' : ''} du jour
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refetch()}
                disabled={isRefetching}
                aria-label="Actualiser"
              >
                <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <TransfertTable
                transferts={filteredTransferts}
                statusMap={statusMap}
                onStatusChange={onStatusChange}
                refetch={refetch}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
