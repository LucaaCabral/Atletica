import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isDemoMode, demoSession, DEMO_PROFILE } from '@/lib/supabase';
import type { Profile } from '@/types';
import { hasPermission, type PermissionKey } from '@/utils/permissions';
import { useTheme } from '@/contexts/ThemeContext';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  can: (permission: PermissionKey) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': 'E-mail ou senha inválidos.',
    'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
    'User already registered': 'Este e-mail já possui cadastro.',
    'Password should be at least 6 characters.': 'A senha deve ter pelo menos 6 caracteres.',
  };
  if (message.includes('Cadastro permitido apenas por convite')) {
    return 'Cadastro permitido apenas por convite. Solicite acesso a um administrador.';
  }
  return map[message] ?? message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { setPreference } = useTheme();

  const loadProfile = useCallback(
    async (userId: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, sector:sectors!profiles_sector_id_fkey(*)')
        .eq('id', userId)
        .single();
      if (error) {
        console.error('Falha ao carregar perfil do usuário:', error);
        return;
      }
      if (data) {
        const p = data as Profile;
        setProfile(p);
        if (p.theme_preference) setPreference(p.theme_preference, false);
      }
    },
    [setPreference],
  );

  useEffect(() => {
    if (isDemoMode) {
      setSession(demoSession);
      setProfile(DEMO_PROFILE);
      setLoading(false);
      return;
    }

    let mounted = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadProfile(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        void loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? translateAuthError(error.message) : null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error: error ? translateAuthError(error.message) : null };
  }, []);

  const signOut = useCallback(async () => {
    if (isDemoMode) return;
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    return { error: error ? translateAuthError(error.message) : null };
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error ? translateAuthError(error.message) : null };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const can = useCallback(
    (permission: PermissionKey) => hasPermission(profile?.role, permission),
    [profile],
  );

  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      can,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      refreshProfile,
    }),
    [session, profile, loading, can, signIn, signUp, signOut, requestPasswordReset, updatePassword, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
