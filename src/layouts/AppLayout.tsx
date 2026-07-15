import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { X } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { IconButton } from '@/components/ui/Button';

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === '1');
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapse = () => {
    setCollapsed((v) => {
      localStorage.setItem('sidebar-collapsed', v ? '0' : '1');
      return !v;
    });
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--color-background)]">
      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMobileOpen(false);
          }}
        >
          <div className="animate-fade-in relative h-full w-64">
            <Sidebar collapsed={false} onToggleCollapse={() => {}} onNavigate={() => setMobileOpen(false)} />
            <IconButton
              label="Fechar menu"
              className="absolute right-2 top-4 bg-[var(--color-surface)]"
              onClick={() => setMobileOpen(false)}
            >
              <X size={18} />
            </IconButton>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
