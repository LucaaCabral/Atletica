import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Management } from '@/types';

interface ManagementContextValue {
  managements: Management[];
  currentManagement: Management | null;
  loaded: boolean;
  switchManagement: (id: string) => Promise<{ error: string | null }>;
  reload: () => Promise<void>;
}

const ManagementContext = createContext<ManagementContextValue | null>(null);

export function ManagementProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth();
  const [managements, setManagements] = useState<Management[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const { data } = await supabase.from('managements').select('*').order('year', { ascending: false });
    setManagements((data ?? []) as Management[]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (session) void reload();
  }, [session, reload]);

  const currentManagement = useMemo(
    () => managements.find((m) => m.is_current) ?? managements[0] ?? null,
    [managements],
  );

  const switchManagement = useCallback(
    async (id: string) => {
      if (!profile || !['presidente', 'vice'].includes(profile.role)) {
        return { error: 'Só presidente ou vice podem trocar a gestão corrente.' };
      }
      const { error: clearError } = await supabase
        .from('managements')
        .update({ is_current: false })
        .eq('is_current', true);
      if (clearError) return { error: clearError.message };
      const { error: setError } = await supabase.from('managements').update({ is_current: true }).eq('id', id);
      if (setError) return { error: setError.message };
      await reload();
      return { error: null };
    },
    [profile, reload],
  );

  const value = useMemo(
    () => ({ managements, currentManagement, loaded, switchManagement, reload }),
    [managements, currentManagement, loaded, switchManagement, reload],
  );

  return <ManagementContext.Provider value={value}>{children}</ManagementContext.Provider>;
}

export function useManagement(): ManagementContextValue {
  const ctx = useContext(ManagementContext);
  if (!ctx) throw new Error('useManagement deve ser usado dentro de ManagementProvider');
  return ctx;
}
