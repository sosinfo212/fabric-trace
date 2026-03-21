import { cn } from '@/lib/utils';

function getTauxColor(taux: number): string {
  if (taux >= 100) return 'bg-green-500 text-white';
  if (taux >= 50) return 'bg-yellow-500 text-white';
  if (taux >= 1) return 'bg-orange-500 text-white';
  return 'bg-red-500 text-white';
}

interface TauxBadgeProps {
  taux: number;
  className?: string;
}

export function TauxBadge({ taux, className }: TauxBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium',
        getTauxColor(taux),
        className
      )}
    >
      {taux}%
    </span>
  );
}
