import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { packingApi } from '@/lib/api';

export default function PackingShowPage() {
  const { id } = useParams();
  const packingListId = Number(id);
  const { data, isLoading } = useQuery({
    queryKey: ['packing-list', packingListId],
    queryFn: () => packingApi.getOne(packingListId),
    enabled: Number.isFinite(packingListId),
  });

  return (
    <DashboardLayout>
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Détail de la Packing List</h1>
        </div>

        {isLoading || !data ? (
          <div className="rounded border p-8 text-center text-muted-foreground">Chargement...</div>
        ) : (
          <>
            <div className="flex flex-wrap gap-4 rounded-lg border-2 border-[#dee2e6] bg-[#f8f9fa] p-4">
              <div><span className="font-semibold">Proforma:</span> {data.proforma}</div>
              <div><span className="font-semibold">Client:</span> {data.client}</div>
              <div><span className="font-semibold">Container:</span> {data.container}</div>
              <div><span className="font-semibold">Date:</span> {new Date(data.date).toLocaleDateString('fr-FR')}</div>
              <div><span className="font-semibold">Instruction Production:</span> {data.clientModel?.instruction || '-'}</div>
              <div><span className="font-semibold">Instruction Logistique:</span> {data.clientModel?.instruction_logistique || '-'}</div>
            </div>

            <div className="overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase">
                  <tr>
                    <th className="p-2 text-center">PAL N°</th>
                    <th className="p-2 text-center">PAL KGS</th>
                    <th className="p-2 text-center">Désignation</th>
                    <th className="p-2 text-center">Quantité</th>
                    <th className="p-2 text-center">Boxes</th>
                    <th className="p-2 text-center">Pièces</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.items]
                    .sort((a, b) => Number(a.palNo || 0) - Number(b.palNo || 0))
                    .map((it) => (
                      <tr key={it.id} className="border-t">
                        <td className="p-2 text-center">{String(it.palNo) === '0' ? 'Vrac' : it.palNo}</td>
                        <td className="p-2 text-center">{it.palKgs ?? '-'}</td>
                        <td className="p-2 text-center">{it.designation}</td>
                        <td className="p-2 text-center">{it.quantity}</td>
                        <td className="p-2 text-center">{it.boxes}</td>
                        <td className="p-2 text-center">{it.pieces}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
