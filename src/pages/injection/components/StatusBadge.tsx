import { cn } from '@/lib/utils';

// Planifié → blue (badge-primary), En cours → yellow (badge-warning), Réalisé → green (badge-success)
const statusColors: Record<string, string> = {
  Planifié: 'bg-blue-500 text-white',
  'En cours': 'bg-yellow-400 text-gray-900',
  Réalisé: 'bg-green-500 text-white',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const classes = statusColors[status] ?? 'bg-gray-400 text-white';
  return (
    <span
      className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium', classes, className)}
    >
      {status}
    </span>
  );
}
