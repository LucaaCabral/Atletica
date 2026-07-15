import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { BrandingSettings, ClubSettings, GeneralSettings, TaskLabelDef } from '@/types';

const DEFAULT_GENERAL: GeneralSettings = {
  organizationName: 'Associação Atlética Acadêmica do Inatel',
  systemName: 'Gestão Atlética',
  description: '',
  contactEmail: '',
  instagram: '',
  website: '',
};

const DEFAULT_BRANDING: BrandingSettings = {
  primaryColor: '',
  secondaryColor: '',
  defaultTheme: 'system',
  logoUrl: '',
  symbolUrl: '',
};

const DEFAULT_CLUB: ClubSettings = {
  planName: 'Sócio Toroloco',
  defaultValidityMonths: 6,
};

const DEFAULT_DOC_CATEGORIES = [
  'Contratos', 'Atas', 'Regulamentos', 'Orçamentos', 'Notas fiscais', 'Comprovantes',
  'Propostas', 'Relatórios', 'Termos', 'Artes', 'Fotos', 'Outros',
];

const DEFAULT_EVENT_CATEGORIES = [
  'Festa', 'Campeonato', 'Jogos universitários', 'Reunião interna', 'Recepção', 'Ação social', 'Outro',
];

interface SettingsContextValue {
  general: GeneralSettings;
  branding: BrandingSettings;
  club: ClubSettings;
  docCategories: string[];
  eventCategories: string[];
  taskLabels: TaskLabelDef[];
  loaded: boolean;
  saveSetting: (key: string, value: unknown) => Promise<{ error: string | null }>;
  reload: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [general, setGeneral] = useState<GeneralSettings>(DEFAULT_GENERAL);
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING);
  const [club, setClub] = useState<ClubSettings>(DEFAULT_CLUB);
  const [docCategories, setDocCategories] = useState<string[]>(DEFAULT_DOC_CATEGORIES);
  const [eventCategories, setEventCategories] = useState<string[]>(DEFAULT_EVENT_CATEGORIES);
  const [taskLabels, setTaskLabels] = useState<TaskLabelDef[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('key, value');
    if (data) {
      for (const row of data as { key: string; value: unknown }[]) {
        switch (row.key) {
          case 'general':
            setGeneral({ ...DEFAULT_GENERAL, ...(row.value as Partial<GeneralSettings>) });
            break;
          case 'branding':
            setBranding({ ...DEFAULT_BRANDING, ...(row.value as Partial<BrandingSettings>) });
            break;
          case 'club':
            setClub({ ...DEFAULT_CLUB, ...(row.value as Partial<ClubSettings>) });
            break;
          case 'doc_categories':
            if (Array.isArray(row.value)) setDocCategories(row.value as string[]);
            break;
          case 'event_categories':
            if (Array.isArray(row.value)) setEventCategories(row.value as string[]);
            break;
          case 'task_labels':
            if (Array.isArray(row.value)) setTaskLabels(row.value as TaskLabelDef[]);
            break;
        }
      }
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (session) void reload();
  }, [session, reload]);

  useEffect(() => {
    const root = document.documentElement;
    if (branding.primaryColor) {
      root.style.setProperty('--color-primary', branding.primaryColor);
      root.style.setProperty('--color-primary-hover', branding.primaryColor);
    } else {
      root.style.removeProperty('--color-primary');
      root.style.removeProperty('--color-primary-hover');
    }
    if (branding.secondaryColor) {
      root.style.setProperty('--color-secondary', branding.secondaryColor);
    } else {
      root.style.removeProperty('--color-secondary');
    }
  }, [branding.primaryColor, branding.secondaryColor]);

  const saveSetting = useCallback(
    async (key: string, value: unknown) => {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() });
      if (!error) await reload();
      return { error: error ? error.message : null };
    },
    [reload],
  );

  const value = useMemo(
    () => ({ general, branding, club, docCategories, eventCategories, taskLabels, loaded, saveSetting, reload }),
    [general, branding, club, docCategories, eventCategories, taskLabels, loaded, saveSetting, reload],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings deve ser usado dentro de SettingsProvider');
  return ctx;
}
