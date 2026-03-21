import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileSpreadsheet } from 'lucide-react';

export function ExportModal({
  open,
  packingListId,
  onClose,
}: {
  open: boolean;
  packingListId: number | null;
  onClose: () => void;
}) {
  if (!packingListId) return null;

  const options = [
    {
      title: 'Export Complet',
      subtitle: 'Toutes les colonnes incluses',
      href: `/api/shipping/packing/${packingListId}/export`,
      ring: 'hover:border-blue-500/60',
      iconBg: 'from-blue-500 to-indigo-500',
    },
    {
      title: 'Export Simplifié',
      subtitle: 'Colonnes essentielles uniquement',
      href: `/api/shipping/packing/${packingListId}/export-simple`,
      ring: 'hover:border-emerald-500/60',
      iconBg: 'from-emerald-500 to-teal-500',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(n) => !n && onClose()}>
      <DialogContent className="max-w-3xl p-0">
        <div className="rounded-t-lg bg-gradient-to-r from-[#667eea] to-[#764ba2] p-5 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Exporter la Packing List</DialogTitle>
          </DialogHeader>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          {options.map((option) => (
            <a
              key={option.title}
              href={option.href}
              className={`rounded-xl border-2 border-transparent bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg ${option.ring}`}
              onClick={() => onClose()}
            >
              <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r ${option.iconBg}`}>
                <FileSpreadsheet className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{option.title}</h3>
              <p className="text-sm text-slate-600">{option.subtitle}</p>
            </a>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
