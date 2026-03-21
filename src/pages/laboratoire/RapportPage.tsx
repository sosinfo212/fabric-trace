import { useMemo, useRef, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { laboratoireApi, type LaboOrdre, type LaboOrdreWithDeclarations, type LaboRack, type LaboStockItem } from '@/lib/api';
import { useLaboratoirePageAccess } from './useLaboratoirePageAccess';
import { StatusBadge } from '@/components/laboratoire/shared/StatusBadge';
import {
  Chart,
  DoughnutController,
  BarController,
  LineController,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';

Chart.register(
  DoughnutController,
  BarController,
  LineController,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Filler,
  Legend
);

type PeriodKey = '7d' | '30d' | '3m' | '6m';

function getPeriodStart(key: PeriodKey, now = new Date()) {
  const d = new Date(now);
  if (key === '7d') d.setDate(d.getDate() - 7);
  if (key === '30d') d.setDate(d.getDate() - 30);
  if (key === '3m') d.setMonth(d.getMonth() - 3);
  if (key === '6m') d.setMonth(d.getMonth() - 6);
  return d;
}

function formatRelative(dateStr: string) {
  const d = new Date(dateStr);
  const diffMs = Date.now() - d.getTime();
  const h = Math.floor(diffMs / (1000 * 60 * 60));
  if (h < 1) return 'Il y a <1h';
  if (h < 24) return `Il y a ${h}h`;
  const j = Math.floor(h / 24);
  return `Il y a ${j}j`;
}

function percentage(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function clampWidth(percent: number) {
  if (percent <= 0) return 30;
  return Math.max(30, Math.min(100, Math.round(percent)));
}

function useChartDefaults() {
  useEffect(() => {
    Chart.defaults.color = '#4a6080';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
    Chart.defaults.font.family = '"DM Sans", sans-serif';
  }, []);
}

function DoughnutChart({ labels, values }: { labels: string[]; values: number[] }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = new Chart(ref.current, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: ['#4d9fff', '#ffb74d', '#00c9a7'], borderWidth: 0 }],
      },
      options: { cutout: '72%', plugins: { legend: { display: false } }, maintainAspectRatio: false },
    });
    return () => chart.destroy();
  }, [labels, values]);
  return <canvas ref={ref} />;
}

function BarTrendChart({ labels, created, closed }: { labels: string[]; created: number[]; closed: number[] }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Créés', data: created, backgroundColor: 'rgba(77,159,255,0.5)', borderRadius: 4 },
          { label: 'Clôturés', data: closed, backgroundColor: 'rgba(0,201,167,0.7)', borderRadius: 4 },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        maintainAspectRatio: false,
        scales: { x: { grid: { color: 'rgba(255,255,255,0.05)' } }, y: { grid: { color: 'rgba(255,255,255,0.05)' } } },
      },
    });
    return () => chart.destroy();
  }, [labels, created, closed]);
  return <canvas ref={ref} />;
}

function LineWeeklyChart({ labels, qty, target }: { labels: string[]; qty: number[]; target: number[] }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = new Chart(ref.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Quantité déclarée', data: qty, borderColor: '#00c9a7', backgroundColor: 'rgba(0,201,167,0.08)', fill: true, tension: 0.35, pointRadius: 3 },
          { label: 'Objectif', data: target, borderColor: 'rgba(255,255,255,0.15)', borderDash: [5, 4], tension: 0.1, pointRadius: 0 },
        ],
      },
      options: { plugins: { legend: { display: false } }, maintainAspectRatio: false },
    });
    return () => chart.destroy();
  }, [labels, qty, target]);
  return <canvas ref={ref} />;
}

export default function LaboratoireRapportPage() {
  useChartDefaults();
  const { authLoading, roleLoading, canAccess } = useLaboratoirePageAccess();
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const startDate = getPeriodStart(period);
  const prevStart = getPeriodStart(period, startDate);

  const qOrdres = useQuery({ queryKey: ['labo-ordres-report'], queryFn: () => laboratoireApi.getOrdres(), enabled: canAccess && !authLoading && !roleLoading });
  const qDecls = useQuery({ queryKey: ['labo-decls-report'], queryFn: () => laboratoireApi.getDeclarations(), enabled: canAccess && !authLoading && !roleLoading });
  const qRacks = useQuery({ queryKey: ['labo-racks-report'], queryFn: () => laboratoireApi.getRacks(), enabled: canAccess && !authLoading && !roleLoading });
  const qStock = useQuery({ queryKey: ['labo-stock-report'], queryFn: () => laboratoireApi.getStockFull(), enabled: canAccess && !authLoading && !roleLoading });

  const ordres = (qOrdres.data?.data ?? []) as LaboOrdre[];
  const declarationOrders = (qDecls.data?.data ?? []) as LaboOrdreWithDeclarations[];
  const declarations = useMemo(
    () =>
      declarationOrders.flatMap((of) =>
        (of.declarations || []).map((d) => ({
          ...d,
          ofId: of.id,
        }))
      ),
    [declarationOrders]
  );
  const racks = (qRacks.data?.data ?? []) as LaboRack[];
  const stock = (qStock.data?.data ?? []) as LaboStockItem[];

  const ordresFiltered = useMemo(() => ordres.filter((o) => new Date(o.createdAt) >= startDate), [ordres, startDate]);
  const declsFiltered = useMemo(() => declarations.filter((d) => new Date(d.createdAt) >= startDate), [declarations, startDate]);
  const ordresPrev = useMemo(() => ordres.filter((o) => new Date(o.createdAt) >= prevStart && new Date(o.createdAt) < startDate), [ordres, prevStart, startDate]);
  const declsPrev = useMemo(() => declarations.filter((d) => new Date(d.createdAt) >= prevStart && new Date(d.createdAt) < startDate), [declarations, prevStart, startDate]);

  const totalPlaces = useMemo(() => racks.reduce((a, r) => a + r.stages * r.places, 0), [racks]);
  const occupied = stock.length;
  const closureCount = ordresFiltered.filter((o) => o.statut === 'Cloture').length;
  const closureRate = percentage(closureCount, ordresFiltered.length);
  const qtyProduced = declsFiltered.reduce((a, d) => a + Number(d.qty || 0), 0);
  const stockOccRate = percentage(occupied, totalPlaces);

  const kpi = [
    { label: 'Ordres totaux', value: ordresFiltered.length.toLocaleString('fr-FR'), accent: '#00c9a7', pct: percentage(ordresFiltered.length, Math.max(1, ordres.length)) },
    { label: 'Taux de clôture', value: `${closureRate}%`, accent: '#00c9a7', pct: closureRate },
    { label: 'Quantité produite', value: qtyProduced.toLocaleString('fr-FR'), accent: '#ffb74d', pct: percentage(qtyProduced, Math.max(1, qtyProduced + declsPrev.reduce((a, d) => a + Number(d.qty || 0), 0))) },
    { label: 'Taux occupation stock', value: `${stockOccRate}%`, accent: '#9c7fe8', pct: stockOccRate },
  ];

  const closurePrev = percentage(ordresPrev.filter((o) => o.statut === 'Cloture').length, ordresPrev.length);
  const qtyPrev = declsPrev.reduce((a, d) => a + Number(d.qty || 0), 0);
  const deltas = [
    ordresFiltered.length - ordresPrev.length,
    closureRate - closurePrev,
    qtyProduced - qtyPrev,
    0,
  ];

  const statusCounts = useMemo(() => ({
    Planifier: ordresFiltered.filter((o) => o.statut === 'Planifier').length,
    En_cours: ordresFiltered.filter((o) => o.statut === 'En_cours').length,
    Cloture: ordresFiltered.filter((o) => o.statut === 'Cloture').length,
  }), [ordresFiltered]);

  const months = useMemo(() => {
    const labels: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.toLocaleDateString('fr-FR', { month: 'short' }));
    }
    const created = labels.map((_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      return ordres.filter((o) => new Date(o.createdAt) >= d && new Date(o.createdAt) < next).length;
    });
    const closed = labels.map((_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      return ordres.filter((o) => o.statut === 'Cloture' && new Date(o.updatedAt || o.createdAt) >= d && new Date(o.updatedAt || o.createdAt) < next).length;
    });
    return { labels, created, closed };
  }, [ordres]);

  const weekly = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of declsFiltered) {
      const dt = new Date(d.createdAt);
      const y = dt.getFullYear();
      const onejan = new Date(dt.getFullYear(), 0, 1);
      const week = Math.ceil((((dt.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
      const key = `${y}-S${String(week).padStart(2, '0')}`;
      map.set(key, (map.get(key) || 0) + Number(d.qty || 0));
    }
    const labels = Array.from(map.keys()).slice(-8);
    const qty = labels.map((k) => map.get(k) || 0);
    const avg = qty.length ? qty.reduce((a, b) => a + b, 0) / qty.length : 0;
    return { labels, qty, target: labels.map(() => Math.round(avg * 1.1)) };
  }, [declsFiltered]);

  const orderDeclQty = useMemo(() => {
    const m = new Map<number, number>();
    for (const d of declarations) m.set(d.ofId, (m.get(d.ofId) || 0) + Number(d.qty || 0));
    return m;
  }, [declarations]);

  const topProducts = useMemo(() => {
    const m = new Map<string, { qty: number; lots: Set<string> }>();
    for (const d of declsFiltered) {
      const cur = m.get(d.produit) || { qty: 0, lots: new Set<string>() };
      cur.qty += Number(d.qty || 0);
      if (d.lot) cur.lots.add(d.lot);
      m.set(d.produit, cur);
    }
    return Array.from(m.entries())
      .map(([produit, v]) => ({ produit, qty: v.qty, lots: v.lots.size }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);
  }, [declsFiltered]);

  const activities = useMemo(() => {
    const act: Array<{ kind: 'decl' | 'close' | 'create' | 'stock'; text: string; at: string }> = [];
    for (const d of declsFiltered.slice(0, 20)) act.push({ kind: 'decl', text: `Déclaration — ${d.produit} × ${d.qty}`, at: d.createdAt });
    for (const o of ordresFiltered.filter((o) => o.statut === 'Cloture').slice(0, 20)) act.push({ kind: 'close', text: `OF clôturé — ${o.produit}`, at: o.updatedAt || o.createdAt });
    for (const o of ordresFiltered.slice(0, 20)) act.push({ kind: 'create', text: `Nouvel ordre — ${o.produit} × ${o.qty}`, at: o.createdAt });
    for (const s of stock.slice(0, 20)) act.push({ kind: 'stock', text: `Lot ${s.lot} affecté — ${s.rackName || 'Rack'} S${s.stage} P${s.place}`, at: s.updatedAt || s.createdAt });
    return act.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 18);
  }, [declsFiltered, ordresFiltered, stock]);

  if (authLoading || roleLoading || qOrdres.isLoading || qDecls.isLoading || qRacks.isLoading || qStock.isLoading) {
    return <DashboardLayout><div className="text-muted-foreground">Chargement...</div></DashboardLayout>;
  }
  if (!canAccess) {
    return <DashboardLayout><div className="text-muted-foreground">Accès non autorisé.</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-7 font-sans text-[#e8edf5]">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-black">Laboratoire / Rapport global</h1>
          <div className="flex items-center gap-2">
            {[
              { key: '7d', label: '7j' },
              { key: '30d', label: '30j' },
              { key: '3m', label: '3 mois' },
              { key: '6m', label: '6 mois' },
            ].map((p) => (
              <button key={p.key} onClick={() => setPeriod(p.key as PeriodKey)} className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${period === p.key ? 'border-white/[0.12] bg-[#1e3050] text-[#e8edf5]' : 'border-white/[0.07] bg-transparent text-[#8fa3bb]'}`}>
                {p.label}
              </button>
            ))}
            <button onClick={() => window.print()} className="rounded-lg bg-[#00c9a7] px-3 py-1.5 text-xs font-medium text-[#0f1929]">Exporter</button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3.5">
          {kpi.map((k, i) => (
            <div key={k.label} className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#162236] p-5">
              <p className="mb-2.5 text-[10px] font-medium uppercase tracking-widest text-[#4a6080]">{k.label}</p>
              <p className={`mb-1.5 text-3xl font-semibold leading-none ${i === 1 ? 'text-[#00c9a7]' : i === 3 ? 'text-[#9c7fe8]' : 'text-[#e8edf5]'}`}>{k.value}</p>
              <p className={`flex items-center gap-1 text-[11.5px] ${deltas[i] > 0 ? 'text-[#4caf78]' : deltas[i] < 0 ? 'text-red-400' : 'text-[#4a6080]'}`}>
                {deltas[i] > 0 ? '+' : ''}{Math.round(deltas[i]).toLocaleString('fr-FR')} vs période précédente
              </p>
              <div className="absolute bottom-0 left-0 h-[3px] rounded-r-sm" style={{ width: `${clampWidth(k.pct)}%`, backgroundColor: k.accent }} />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/[0.07] bg-[#162236] p-5">
            <h3 className="mb-3 text-sm font-semibold text-[#e8edf5]">Répartition des ordres par statut</h3>
            <div className="mb-3 flex gap-4 text-xs">
              {['#4d9fff', '#ffb74d', '#00c9a7'].map((c, idx) => (
                <span key={c} className="flex items-center gap-1.5"><span className="h-[9px] w-[9px] rounded-sm" style={{ backgroundColor: c }} />{['Planifier', 'En cours', 'Clôturé'][idx]}</span>
              ))}
            </div>
            <div className="relative h-[200px] w-full"><DoughnutChart labels={['Planifier', 'En_cours', 'Cloture']} values={[statusCounts.Planifier, statusCounts.En_cours, statusCounts.Cloture]} /></div>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-[#162236] p-5">
            <h3 className="mb-3 text-sm font-semibold text-[#e8edf5]">Tendance mensuelle des ordres</h3>
            <div className="mb-3 flex gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-[9px] w-[9px] rounded-sm bg-[#4d9fff]/80" />Créés</span>
              <span className="flex items-center gap-1.5"><span className="h-[9px] w-[9px] rounded-sm bg-[#00c9a7]/80" />Clôturés</span>
            </div>
            <div className="relative h-[200px] w-full"><BarTrendChart labels={months.labels} created={months.created} closed={months.closed} /></div>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-[#162236] p-5">
          <h3 className="mb-3 text-sm font-semibold text-[#e8edf5]">Production hebdomadaire</h3>
          <div className="relative h-[200px] w-full"><LineWeeklyChart labels={weekly.labels} qty={weekly.qty} target={weekly.target} /></div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#162236]">
            <table className="w-full">
              <thead><tr>{['Produit', 'Qté', 'Statut', 'Avancement'].map((h) => <th key={h} className="border-b border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-widest text-[#8fa3bb]">{h}</th>)}</tr></thead>
              <tbody>
                {ordresFiltered.slice(0, 10).map((o) => {
                  const done = orderDeclQty.get(o.id) || 0;
                  const pct = Math.min(100, percentage(done, o.qty));
                  return <tr key={o.id} className="hover:bg-white/[0.02]">
                    <td className="max-w-[160px] border-b border-white/[0.07] px-4 py-3 text-[13px] last:border-b-0 truncate">{o.produit}</td>
                    <td className="border-b border-white/[0.07] px-4 py-3 text-[13px]">{Number(o.qty).toLocaleString('fr-FR')}</td>
                    <td className="border-b border-white/[0.07] px-4 py-3 text-[13px]"><StatusBadge statut={o.statut} /></td>
                    <td className="border-b border-white/[0.07] px-4 py-3 text-[13px]">
                      <div className="flex items-center gap-2.5"><div className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#00c9a7' : pct > 0 ? '#ffb74d' : '#4a6080' }} /></div><span className="font-mono text-[11.5px] text-[#8fa3bb]">{pct}%</span></div>
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#162236]">
            <table className="w-full">
              <thead><tr>{['Produit', 'Qté', 'N° Lot', 'Date'].map((h) => <th key={h} className="border-b border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-widest text-[#8fa3bb]">{h}</th>)}</tr></thead>
              <tbody>
                {declsFiltered.slice(0, 8).map((d) => <tr key={d.id} className="hover:bg-white/[0.02]">
                  <td className="max-w-[160px] border-b border-white/[0.07] px-4 py-3 text-[13px] truncate">{d.produit}</td>
                  <td className="border-b border-white/[0.07] px-4 py-3 text-[13px]">{Number(d.qty).toLocaleString('fr-FR')}</td>
                  <td className="border-b border-white/[0.07] px-4 py-3 text-[13px] font-mono text-[11.5px] text-[#00c9a7]">{d.lot}</td>
                  <td className="border-b border-white/[0.07] px-4 py-3 text-[12px] text-[#8fa3bb]">{new Date(d.createdAt).toLocaleDateString('fr-FR')}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-lg font-semibold text-black">Visualisation du stock</h2>
              <p className="text-sm text-[#8fa3bb]">Occupation par rack et par étage</p>
            </div>
            <p className="text-sm text-[#8fa3bb]"><span className="text-[#00c9a7]">{occupied}</span> / {totalPlaces} emplacements occupés</p>
          </div>
          <div className="grid grid-cols-3 gap-3.5">
            {racks.map((r) => {
              const rackStock = stock.filter((s) => s.rackId === r.id);
              const rackTotal = r.stages * r.places;
              const rackOcc = rackStock.length;
              const keys = new Set(rackStock.map((s) => `${s.stage}-${s.place}`));
              return <div key={r.id} className="rounded-xl border border-white/[0.07] bg-[#162236] p-4">
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#00c9a7]">{r.name}</p>
                {Array.from({ length: r.stages }).map((_, si) => {
                  const stage = si + 1;
                  return <div key={stage} className="mb-2">
                    <p className="mb-1 text-[10px] text-[#4a6080]">Étage {stage}</p>
                    <div className="flex flex-wrap gap-1">{Array.from({ length: r.places }).map((__, pi) => {
                      const place = pi + 1;
                      const occ = keys.has(`${stage}-${place}`);
                      return <div key={place} className={`flex h-6 w-7 items-center justify-center rounded border text-[9px] ${occ ? 'border-[#00c9a7]/30 bg-[#00c9a7]/10 text-[#00c9a7]' : 'border-white/[0.07] bg-transparent text-[#4a6080]'}`}>{place}</div>;
                    })}</div>
                  </div>;
                })}
                <div className="mt-2 flex items-center gap-2.5"><div className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full bg-[#00c9a7]" style={{ width: `${percentage(rackOcc, rackTotal)}%` }} /></div><span className="font-mono text-[11.5px] text-[#8fa3bb]">{rackOcc}/{rackTotal}</span></div>
              </div>;
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#162236]">
            <table className="w-full">
              <thead><tr>{['Produit', 'Qté totale', 'Nbre lots', 'Part'].map((h) => <th key={h} className="border-b border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-widest text-[#8fa3bb]">{h}</th>)}</tr></thead>
              <tbody>
                {topProducts.map((p) => {
                  const max = topProducts[0]?.qty || 1;
                  const part = percentage(p.qty, max);
                  return <tr key={p.produit} className="hover:bg-white/[0.02]">
                    <td className="max-w-[160px] border-b border-white/[0.07] px-4 py-3 text-[13px] truncate">{p.produit}</td>
                    <td className="border-b border-white/[0.07] px-4 py-3 text-[13px]">{p.qty.toLocaleString('fr-FR')}</td>
                    <td className="border-b border-white/[0.07] px-4 py-3 text-[13px]">{p.lots.toLocaleString('fr-FR')}</td>
                    <td className="border-b border-white/[0.07] px-4 py-3 text-[13px]"><div className="flex items-center gap-2.5"><div className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full bg-[#00c9a7]" style={{ width: `${part}%` }} /></div><span className="font-mono text-[11.5px] text-[#8fa3bb]">{part}%</span></div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#162236]">
            {activities.map((a, i) => (
              <div key={`${a.at}-${i}`} className="flex items-start gap-3.5 border-b border-white/[0.07] px-4 py-3 last:border-b-0">
                <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${a.kind === 'decl' ? 'bg-amber-400' : a.kind === 'close' || a.kind === 'stock' ? 'bg-[#00c9a7]' : 'bg-[#4d9fff]'}`} />
                <p className="flex-1 text-[13px] text-[#e8edf5]">{a.text}</p>
                <p className="whitespace-nowrap font-mono text-[11px] text-[#4a6080]">{formatRelative(a.at)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
