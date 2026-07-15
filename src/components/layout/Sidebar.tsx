import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  PartyPopper,
  Wallet,
  Trophy,
  Megaphone,
  Handshake,
  BadgeCheck,
  FolderOpen,
  CalendarDays,
  BarChart3,
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import type { PermissionKey } from '@/utils/permissions';
import { cn } from '@/utils/cn';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission: PermissionKey;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
  { to: '/diretoria', label: 'Diretoria', icon: Users, permission: 'members.view' },
  { to: '/tarefas', label: 'Tarefas', icon: CheckSquare, permission: 'tasks.view' },
  { to: '/eventos', label: 'Eventos', icon: PartyPopper, permission: 'events.view' },
  { to: '/financeiro', label: 'Financeiro', icon: Wallet, permission: 'finance.view' },
  { to: '/esportes', label: 'Esportes', icon: Trophy, permission: 'sports.view' },
  { to: '/marketing', label: 'Marketing', icon: Megaphone, permission: 'marketing.view' },
  { to: '/patrocinadores', label: 'Patrocinadores', icon: Handshake, permission: 'sponsors.view' },
  { to: '/socios', label: 'Sócios', icon: BadgeCheck, permission: 'club.view' },
  { to: '/documentos', label: 'Documentos', icon: FolderOpen, permission: 'documents.view' },
  { to: '/calendario', label: 'Calendário', icon: CalendarDays, permission: 'calendar.view' },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3, permission: 'reports.view' },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, permission: 'settings.manage' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate?: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse, onNavigate }: SidebarProps) {
  const { can } = useAuth();
  const { general, branding } = useSettings();

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-all',
        collapsed ? 'w-[68px]' : 'w-60',
      )}
    >
      <div className="flex items-center gap-2.5 px-4 py-4">
        {branding.logoUrl ? (
          <img src={branding.logoUrl} alt={general.organizationName} className="h-9 w-9 rounded-lg object-contain" />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)] text-sm font-bold text-white">
            {general.systemName.slice(0, 2).toUpperCase()}
          </span>
        )}
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight">{general.systemName}</p>
            <p className="truncate text-[11px] text-[var(--color-text-muted)]">Atlética Inatel</p>
          </div>
        )}
      </div>

      <nav aria-label="Menu principal" className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-2">
        {navItems
          .filter((item) => can(item.permission))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  collapsed && 'justify-center px-2',
                  isActive
                    ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]',
                )
              }
            >
              <item.icon size={18} aria-hidden className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
      </nav>

      <div className="hidden border-t border-[var(--color-border)] p-2.5 lg:block">
        <button
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)]',
            'hover:bg-[var(--color-surface-hover)]',
            collapsed && 'justify-center px-2',
          )}
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          {!collapsed && <span>Recolher</span>}
        </button>
      </div>
    </aside>
  );
}
