import { cn } from '@/lib/utils';

/** Rebuts page: % conformity — >=95% green, >=80% yellow, <80% red */
export function getConformityColor(rate: number): string {
  if (rate >= 95) return 'bg-green-500 text-white';
  if (rate >= 80) return 'bg-yellow-400 text-gray-900';
  return 'bg-red-500 text-white';
}

interface ConformityBadgeProps {
  conformity: number;
  className?: string;
}

export function ConformityBadge({ conformity, className }: ConformityBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium',
        getConformityColor(conformity),
        className
      )}
    >
      {conformity}%
    </span>
  );
}
