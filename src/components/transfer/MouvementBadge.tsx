import { cn } from '@/lib/utils';

interface MouvementBadgeProps {
  mouvement: string;
  variant?: 'index' | 'rapport';
  className?: string;
}

export function MouvementBadge({ mouvement, variant = 'index', className }: MouvementBadgeProps) {
  const isAM = mouvement === 'A->M' || mouvement === 'A→M';
  const isMA = mouvement === 'M->A' || mouvement === 'M→A';
  const style = isAM
    ? variant === 'rapport'
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-primary text-primary-foreground'
    : isMA
      ? 'bg-red-500 text-white'
      : 'bg-muted text-muted-foreground';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold',
        style,
        className
      )}
    >
      {mouvement}
    </span>
  );
}
