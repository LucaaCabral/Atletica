import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Moon, Search, Sun, LogOut, User, KeyRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { IconButton } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Dropdown } from '@/components/ui/Dropdown';
import { GlobalSearch } from '@/components/layout/GlobalSearch';
import { NotificationsPanel } from '@/components/layout/NotificationsPanel';
import { roleLabels } from '@/utils/labels';

export function Topbar({ onOpenMobileMenu }: { onOpenMobileMenu: () => void }) {
  const { profile, signOut } = useAuth();
  const { resolved, toggle } = useTheme();
  const { branding } = useSettings();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 sm:px-4">
      <IconButton label="Abrir menu" className="lg:hidden" onClick={onOpenMobileMenu}>
        <Menu size={20} />
      </IconButton>

      {branding.logoUrl && (
        <img
          src={branding.logoUrl}
          alt="Gestão Atlética"
          className="h-8 w-8 shrink-0 rounded-lg object-contain lg:hidden"
        />
      )}

      <button
        onClick={() => setSearchOpen(true)}
        className="flex h-9 flex-1 max-w-md items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]"
      >
        <Search size={15} aria-hidden />
        <span className="flex-1 text-left">Buscar…</span>
        <kbd className="hidden rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] sm:inline">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <IconButton label={resolved === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} onClick={toggle}>
          {resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </IconButton>

        <NotificationsPanel />

        <Dropdown
          trigger={
            <button
              className="ml-1 flex items-center gap-2 rounded-lg p-1 hover:bg-[var(--color-surface-hover)]"
              aria-label="Menu do usuário"
            >
              <Avatar name={profile?.full_name} src={profile?.avatar_url} size="sm" />
              <span className="hidden text-left md:block">
                <span className="block max-w-32 truncate text-sm font-medium leading-tight">
                  {profile?.nickname || profile?.full_name}
                </span>
                <span className="block text-[11px] text-[var(--color-text-muted)]">
                  {profile ? roleLabels[profile.role] : ''}
                </span>
              </span>
            </button>
          }
          items={[
            { label: 'Meu perfil', icon: <User size={15} />, onClick: () => navigate('/perfil') },
            { label: 'Alterar senha', icon: <KeyRound size={15} />, onClick: () => navigate('/perfil?aba=senha') },
            {
              label: 'Sair',
              icon: <LogOut size={15} />,
              danger: true,
              onClick: () => {
                void signOut().then(() => navigate('/login'));
              },
            },
          ]}
        />
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
