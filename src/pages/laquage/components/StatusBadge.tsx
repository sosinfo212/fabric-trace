import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  Planifié: 'bg-gray-200 text-gray-700',
  'En cours': 'bg-yellow-100 text-yellow-800',
  Réalisé: 'bg-green-100 text-green-800',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const classes = statusColors[status] ?? 'bg-gray-100 text-gray-700';
  return (
    <span
      className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium', classes, className)}
    >
      {status}
    </span>
  );
}
