import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/State';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  loading?: boolean;
  children: ReactNode;
  actions?: ReactNode;
}

export function ChartCard({ title, subtitle, loading, children, actions }: ChartCardProps) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-[var(--color-text-muted)]">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {loading ? <Skeleton className="h-64 w-full" /> : children}
    </Card>
  );
}

export const chartTooltipStyle = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--color-text)',
};
