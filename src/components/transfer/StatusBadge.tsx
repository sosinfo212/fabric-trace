import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  Envoyé: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Récéptionné: 'bg-green-100 text-green-800 border-green-200',
  Annulé: 'bg-red-100 text-red-800 border-red-200',
  Validé: 'bg-blue-100 text-blue-800 border-blue-200',
  Cloturé: 'bg-gray-100 text-gray-800 border-gray-200',
  Planifié: 'bg-gray-800 text-white border-gray-700',
};

interface StatusBadgeProps {
  statut: string;
  className?: string;
}

export function StatusBadge({ statut, className }: StatusBadgeProps) {
  const style = statusStyles[statut] ?? 'bg-muted text-muted-foreground border-border';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold',
        style,
        className
      )}
    >
      {statut}
    </span>
  );
}
