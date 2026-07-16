import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]',
        className,
      )}
      {...props}
    />
  );
}

export interface KpiCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  onClick?: () => void;
  loading?: boolean;
}

const toneText: Record<NonNullable<KpiCardProps['tone']>, string> = {
  default: 'text-[var(--color-text)]',
  success: 'text-[var(--color-success)]',
  warning: 'text-[var(--color-warning)]',
  danger: 'text-[var(--color-danger)]',
  info: 'text-[var(--color-info)]',
};

export function KpiCard({ title, value, icon, hint, tone = 'default', onClick, loading }: KpiCardProps) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">{title}</p>
        {icon && <span className="text-[var(--color-text-muted)]">{icon}</span>}
      </div>
      {loading ? (
        <div className="mt-2 h-8 w-24 animate-shimmer rounded bg-[var(--color-surface-secondary)]" />
      ) : (
        <p className={cn('mt-1 text-2xl font-bold tracking-tight', toneText[tone])}>{value}</p>
      )}
      {hint && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left',
          'shadow-[var(--shadow-card)] transition-colors hover:border-[var(--color-primary)] w-full',
        )}
      >
        {content}
      </button>
    );
  }

  return <Card className="p-4">{content}</Card>;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={className}>
      {label && (
        <div className="mb-1 flex justify-between text-xs text-[var(--color-text-secondary)]">
          <span>{label}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-secondary)]"
      >
        <div
          className="h-full rounded-full bg-[var(--color-secondary)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
