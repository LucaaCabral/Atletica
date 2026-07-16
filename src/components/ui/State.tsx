import type { ReactNode } from 'react';
import { Loader2, Inbox, AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';

export function Spinner({ className }: { className?: string }) {
  return (
    <span role="status" aria-label="Carregando" className={cn('inline-flex', className)}>
      <Loader2 className="animate-spin text-[var(--color-primary)]" size={24} aria-hidden />
    </span>
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex h-full min-h-[40dvh] items-center justify-center">
      <Spinner />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('animate-shimmer rounded-xl bg-[var(--color-surface-secondary)]', className)}
    />
  );
}

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="rounded-full bg-[var(--color-surface-secondary)] p-3 text-[var(--color-text-muted)]">
        {icon ?? <Inbox size={24} aria-hidden />}
      </span>
      <p className="font-medium text-[var(--color-text)]">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button className="mt-2" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="rounded-full bg-[var(--color-danger-soft)] p-3 text-[var(--color-danger)]">
        <AlertCircle size={24} aria-hidden />
      </span>
      <p className="font-medium">Algo deu errado</p>
      <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
