import { Outlet } from 'react-router-dom';
import { useSettings } from '@/contexts/SettingsContext';

export function AuthLayout() {
  const { general } = useSettings();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--color-background)] p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-xl font-bold text-white">
            {general.systemName.slice(0, 2).toUpperCase()}
          </span>
          <h1 className="text-xl font-bold">{general.systemName}</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">{general.organizationName}</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
