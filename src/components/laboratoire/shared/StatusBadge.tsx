import { cn } from '@/lib/utils';
import type { LaboStatut } from '@/lib/api';

const map: Record<LaboStatut, { label: string; cls: string; dot: string }> = {
  Planifier: {
    label: 'Planifier',
    cls: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    dot: 'bg-blue-400',
  },
  En_cours: {
    label: 'En cours',
    cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    dot: 'bg-amber-400',
  },
  Cloture: {
    label: 'Clôturé',
    cls: 'bg-teal-500/10 text-teal-400 border border-teal-500/20',
    dot: 'bg-teal-400',
  },
};

export function StatusBadge({ statut }: { statut: LaboStatut }) {
  const v = map[statut];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs', v.cls)}>
      <span className={cn('h-[5px] w-[5px] rounded-full', v.dot)} />
      {v.label}
    </span>
  );
}

