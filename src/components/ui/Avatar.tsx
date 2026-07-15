import { cn } from '@/utils/cn';
import { initials } from '@/utils/format';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<Size, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
};

export interface AvatarProps {
  name: string | null | undefined;
  src?: string | null;
  size?: Size;
  className?: string;
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        'bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]',
        sizeClasses[size],
        className,
      )}
    >
      {src ? (
        <img src={src} alt={name ?? 'Avatar'} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
    </span>
  );
}

export interface AvatarGroupProps {
  people: { name: string; src?: string | null }[];
  max?: number;
  size?: Size;
}

export function AvatarGroup({ people, max = 4, size = 'sm' }: AvatarGroupProps) {
  const visible = people.slice(0, max);
  const remaining = people.length - visible.length;
  return (
    <span className="inline-flex items-center -space-x-2">
      {visible.map((p, i) => (
        <Avatar
          key={`${p.name}-${i}`}
          name={p.name}
          src={p.src}
          size={size}
          className="ring-2 ring-[var(--color-surface)]"
        />
      ))}
      {remaining > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-[var(--color-surface-secondary)]',
            'font-medium text-[var(--color-text-secondary)] ring-2 ring-[var(--color-surface)]',
            sizeClasses[size],
          )}
        >
          +{remaining}
        </span>
      )}
    </span>
  );
}
