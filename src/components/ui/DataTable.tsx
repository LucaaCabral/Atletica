import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Skeleton } from '@/components/ui/State';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyState?: ReactNode;
}

export function DataTable<T>({ columns, rows, rowKey, onRowClick, loading, emptyState }: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <div className="p-6">{emptyState}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  'px-4 py-3 font-medium text-[var(--color-text-secondary)] whitespace-nowrap',
                  col.hideOnMobile && 'hidden md:table-cell',
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'border-b border-[var(--color-border)] last:border-0',
                onRowClick && 'cursor-pointer hover:bg-[var(--color-surface-hover)]',
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn('px-4 py-3', col.hideOnMobile && 'hidden md:table-cell', col.className)}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label="Paginação"
      className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-3 text-sm"
    >
      <span className="text-[var(--color-text-secondary)]">
        Página {page} de {totalPages} · {total} registro{total === 1 ? '' : 's'}
      </span>
      <div className="flex gap-1">
        <button
          aria-label="Página anterior"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg border border-[var(--color-border)] p-1.5 disabled:opacity-40 hover:bg-[var(--color-surface-hover)]"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          aria-label="Próxima página"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-[var(--color-border)] p-1.5 disabled:opacity-40 hover:bg-[var(--color-surface-hover)]"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}
