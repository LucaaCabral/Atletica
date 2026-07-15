import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToast, type ToastType } from '@/contexts/ToastContext';
import { cn } from '@/utils/cn';

const icons: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const colors: Record<ToastType, string> = {
  success: 'text-[var(--color-success)]',
  error: 'text-[var(--color-danger)]',
  info: 'text-[var(--color-info)]',
  warning: 'text-[var(--color-warning)]',
};

export function ToastViewport() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-[60] flex flex-col items-center gap-2 sm:left-auto sm:items-end"
    >
      {toasts.map((t) => {
        const Icon = icons[t.type];
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              'animate-fade-in flex w-full max-w-sm items-start gap-2.5 rounded-xl border',
              'border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-popover)]',
            )}
          >
            <Icon size={18} className={cn('mt-0.5 shrink-0', colors[t.type])} aria-hidden />
            <p className="flex-1 text-sm">{t.message}</p>
            <button
              aria-label="Fechar notificação"
              onClick={() => dismiss(t.id)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
