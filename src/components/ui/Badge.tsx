import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]',
  primary: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
  success: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
  info: 'bg-[var(--color-info-soft)] text-[var(--color-info)]',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export type BadgeTone = Tone;

export const taskStatusTones: Record<string, Tone> = {
  backlog: 'neutral',
  todo: 'info',
  in_progress: 'warning',
  in_review: 'primary',
  done: 'success',
  cancelled: 'danger',
};

export const priorityTones: Record<string, Tone> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
};

export const eventStatusTones: Record<string, Tone> = {
  planning: 'neutral',
  preparing: 'info',
  confirmed: 'primary',
  ongoing: 'warning',
  finished: 'success',
  cancelled: 'danger',
};

export const transactionStatusTones: Record<string, Tone> = {
  pending: 'warning',
  paid: 'success',
  overdue: 'danger',
  cancelled: 'neutral',
  partial: 'info',
};

export const marketingStatusTones: Record<string, Tone> = {
  received: 'neutral',
  in_analysis: 'info',
  in_production: 'warning',
  awaiting_approval: 'primary',
  changes_requested: 'danger',
  approved: 'success',
  scheduled: 'info',
  published: 'success',
  cancelled: 'neutral',
};

export const sponsorStatusTones: Record<string, Tone> = {
  prospecting: 'neutral',
  contacted: 'info',
  meeting_scheduled: 'info',
  proposal_sent: 'primary',
  negotiating: 'warning',
  closed: 'success',
  lost: 'danger',
  ended: 'neutral',
  renewal: 'warning',
};

export const clubStatusTones: Record<string, Tone> = {
  active: 'success',
  pending: 'warning',
  expired: 'danger',
  cancelled: 'neutral',
};
