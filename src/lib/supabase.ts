import { createClient } from '@supabase/supabase-js';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { Profile } from '@/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Modo demonstração: ativo quando o Supabase não está configurado no .env
 * (ou quando VITE_DEMO_MODE=true). Sem login, sem banco — o app abre direto
 * no dashboard com um perfil de administrador fictício e listas vazias.
 */
export const isDemoMode =
  !isSupabaseConfigured || import.meta.env.VITE_DEMO_MODE === 'true';

const DEMO_MESSAGE = 'Modo demonstração: o banco de dados está desconectado.';

export const DEMO_PROFILE: Profile = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'demo@atletica.local',
  full_name: 'Visitante da Demonstração',
  nickname: 'Demo',
  phone: null,
  avatar_url: null,
  role: 'admin',
  department_id: null,
  position_title: null,
  theme_preference: 'system',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  department: null,
};

const demoUser = {
  id: DEMO_PROFILE.id,
  email: DEMO_PROFILE.email,
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: { full_name: DEMO_PROFILE.full_name },
  created_at: DEMO_PROFILE.created_at,
} as unknown as User;

export const demoSession = {
  access_token: 'demo',
  refresh_token: 'demo',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: demoUser,
} as unknown as Session;

interface DemoResult {
  data: unknown;
  error: { message: string } | null;
  count: number;
}

const MUTATION_METHODS = new Set(['insert', 'update', 'delete', 'upsert']);
const SINGLE_METHODS = new Set(['single', 'maybeSingle']);

/**
 * Query builder falso: aceita qualquer encadeamento (.select().eq().order()…)
 * e, ao ser aguardado, devolve listas vazias para leituras e um erro claro
 * para escritas.
 */
function createDemoQuery(): unknown {
  const state = { mutated: false, single: false };
  const target = () => undefined;
  const proxy: unknown = new Proxy(target, {
    get(_t, prop: string | symbol) {
      if (prop === 'then') {
        const result: DemoResult = {
          data: state.mutated || state.single ? null : [],
          error: state.mutated ? { message: DEMO_MESSAGE } : null,
          count: 0,
        };
        return (
          resolve: (value: DemoResult) => unknown,
          _reject?: (reason: unknown) => unknown,
        ) => Promise.resolve(result).then(resolve);
      }
      return (..._args: unknown[]) => {
        if (typeof prop === 'string') {
          if (MUTATION_METHODS.has(prop)) state.mutated = true;
          if (SINGLE_METHODS.has(prop)) state.single = true;
        }
        return proxy;
      };
    },
  });
  return proxy;
}

function createDemoClient(): SupabaseClient {
  const demoError = { message: DEMO_MESSAGE };
  const client = {
    from: () => createDemoQuery(),
    auth: {
      getSession: async () => ({ data: { session: demoSession }, error: null }),
      getUser: async () => ({ data: { user: demoUser }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => undefined } },
      }),
      signInWithPassword: async () => ({ data: null, error: demoError }),
      signUp: async () => ({ data: null, error: demoError }),
      signOut: async () => ({ error: null }),
      resetPasswordForEmail: async () => ({ data: null, error: demoError }),
      updateUser: async () => ({ data: null, error: demoError }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: demoError }),
        remove: async () => ({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
        createSignedUrl: async () => ({ data: null, error: demoError }),
      }),
    },
  };
  return client as unknown as SupabaseClient;
}

export const supabase: SupabaseClient = isDemoMode
  ? createDemoClient()
  : createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
