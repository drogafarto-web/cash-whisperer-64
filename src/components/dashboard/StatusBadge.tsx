import { cn } from '@/lib/utils';

export type StatusLevel = 'success' | 'warning' | 'danger';

interface StatusBadgeProps {
  level: StatusLevel;
  children: React.ReactNode;
  className?: string;
}

const levelStyles: Record<StatusLevel, string> = {
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  danger: 'bg-destructive/10 text-destructive border-destructive/20',
};

export function StatusBadge({ level, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border',
        levelStyles[level],
        className
      )}
    >
      {children}
    </span>
  );
}

export function getMarginLevel(margin: number): StatusLevel {
  if (margin >= 0.15) return 'success';
  if (margin >= 0.10) return 'warning';
  return 'danger';
}

export function getFatorRLevel(fatorR: number): StatusLevel {
  if (fatorR >= 0.32) return 'success';
  if (fatorR >= 0.25) return 'warning';
  return 'danger';
}

export function getCashDifferenceLevel(diff: number, threshold: number = 50): StatusLevel {
  const absDiff = Math.abs(diff);
  if (absDiff <= threshold) return 'success';
  if (absDiff <= threshold * 2) return 'warning';
  return 'danger';
}
