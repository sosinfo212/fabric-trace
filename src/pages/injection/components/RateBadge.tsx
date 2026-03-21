import { cn } from '@/lib/utils';

/** Orders page: taux de réalisation — >=100% green, >0% blue, 0% gray */
export function getRateColor(rate: number): string {
  if (rate >= 100) return 'bg-green-500 text-white';
  if (rate > 0) return 'bg-blue-500 text-white';
  return 'bg-gray-400 text-white';
}

interface RateBadgeProps {
  rate: number;
  className?: string;
}

export function RateBadge({ rate, className }: RateBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium',
        getRateColor(rate),
        className
      )}
    >
      {rate}%
    </span>
  );
}
