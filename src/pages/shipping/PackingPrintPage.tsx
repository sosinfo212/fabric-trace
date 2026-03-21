import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { packingApi } from '@/lib/api';

export default function PackingPrintPage() {
  const { id } = useParams();
  const packingListId = Number(id);
  const { data, isLoading } = useQuery({
    queryKey: ['packing-print', packingListId],
    queryFn: () => packingApi.getOne(packingListId),
    enabled: Number.isFinite(packingListId),
  });

  if (isLoading || !data) {
    return <div className="p-8 text-center">Chargement...</div>;
  }

  const totalPieces = data.items.reduce((sum, it) => sum + it.quantity, 0);
  const totalBoxes = data.items.reduce((sum, it) => sum + it.boxes, 0);
  const totalPallets = new Set(data.items.filter((it) => it.palNo !== '0').map((it) => it.palNo)).size;
  const normalItems = data.items.filter((it) => it.palNo !== '0');
  const vracItems = data.items.filter((it) => it.palNo === '0');
  const grouped = normalItems.reduce<Record<string, typeof normalItems>>((acc, item) => {
    const key = item.palNo;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
  const orderedPalNos = Object.keys(grouped).sort((a, b) => Number(a) - Number(b));

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 bg-white p-5 text-black print:max-w-none print:p-0">
      <style>{`@media print { .no-print { display:none!important; } @page { size: A4; margin: 0.5in; } }`}</style>
      <div className="no-print flex justify-end">
        <Button onClick={() => window.print()}>Imprimer</Button>
      </div>
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-gray-500">PACKING LIST</h1>
        <div className="text-right text-sm">
          <div><strong>Client:</strong> {data.client}</div>
          <div><strong>Date:</strong> {new Date(data.date).toLocaleDateString('fr-FR')}</div>
          <div><strong>Container:</strong> {data.container}</div>
          <div><strong>Proforma:</strong> {data.proforma}</div>
        </div>
      </div>
      <h2 className="text-center text-lg font-bold">PACKING LIST AVANT CHARGEMENT</h2>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {['PAL N°', 'PAL KGS', 'DESIGNATION', 'QUANTITY', 'BOXES', 'PIECES'].map((h) => (
              <th key={h} className="border border-black bg-gray-200 p-1">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orderedPalNos.map((palNo) =>
            grouped[palNo].map((it, idx) => (
              <tr key={it.id}>
                {idx === 0 ? (
                  <td rowSpan={grouped[palNo].length} className="border border-black p-1 text-center align-middle">
                    {palNo}
                  </td>
                ) : null}
                <td className="border border-black p-1 text-center">{it.palKgs ?? ''}</td>
                <td className="border border-black p-1">{it.designation}</td>
                <td className="border border-black p-1 text-center">{it.quantity}</td>
                <td className="border border-black p-1 text-center">{it.boxes}</td>
                <td className="border border-black p-1 text-center">{it.pieces}</td>
              </tr>
            )),
          )}
          {vracItems.length ? (
            <>
              <tr>
                <td colSpan={6} className="border border-black bg-gray-100 p-1 text-center font-semibold">
                  Vrac
                </td>
              </tr>
              {vracItems.map((it) => (
                <tr key={it.id}>
                  <td className="border border-black p-1 text-center">Vrac</td>
                  <td className="border border-black p-1 text-center">{it.palKgs ?? ''}</td>
                  <td className="border border-black p-1">{it.designation}</td>
                  <td className="border border-black p-1 text-center">{it.quantity}</td>
                  <td className="border border-black p-1 text-center">{it.boxes}</td>
                  <td className="border border-black p-1 text-center">{it.pieces}</td>
                </tr>
              ))}
            </>
          ) : null}
        </tbody>
      </table>

      <table className="w-full border-collapse text-sm">
        <tbody>
          <tr>
            <td className="border border-black bg-gray-200 p-2 font-semibold">TOTAL NUMBER OF PIECES</td>
            <td className="border border-black p-2">{totalPieces.toLocaleString('fr-FR')}</td>
            <td className="border border-black bg-gray-200 p-2 font-semibold">TOTAL NUMBER OF BOXES</td>
            <td className="border border-black p-2">{totalBoxes.toLocaleString('fr-FR')}</td>
          </tr>
          <tr>
            <td className="border border-black bg-gray-200 p-2 font-semibold">TOTAL NUMBER OF PALLETS</td>
            <td className="border border-black p-2">{totalPallets.toLocaleString('fr-FR')}</td>
            <td className="border border-black bg-gray-200 p-2 font-semibold">VOLUME</td>
            <td className="border border-black p-2">{data.volume || ''}</td>
          </tr>
          <tr>
            <td className="border border-black bg-gray-200 p-2 font-semibold">NAVALOCK</td>
            <td className="border border-black p-2">{data.navalock || ''}</td>
            <td className="border border-black bg-gray-200 p-2 font-semibold">NOTES</td>
            <td className="border border-black p-2">{data.notes || ''}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
