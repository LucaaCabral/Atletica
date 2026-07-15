import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Notification } from '@/types';
import { Drawer } from '@/components/ui/Modal';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/State';
import { formatRelative } from '@/utils/format';
import { cn } from '@/utils/cn';

export function NotificationsPanel() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(30);
    const list = (data ?? []) as Notification[];
    setItems(list);
    setUnread(list.filter((n) => !n.is_read).length);
  }, [profile]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const markRead = async (notification: Notification) => {
    if (!notification.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id);
      void load();
    }
    if (notification.link) {
      setOpen(false);
      navigate(notification.link);
    }
  };

  const markAllRead = async () => {
    if (!profile) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false);
    void load();
  };

  return (
    <>
      <span className="relative">
        <IconButton label="Notificações" onClick={() => setOpen(true)}>
          <Bell size={18} />
        </IconButton>
        {unread > 0 && (
          <span
            aria-label={`${unread} notificações não lidas`}
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] font-bold text-white"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </span>

      <Drawer open={open} onClose={() => setOpen(false)} title="Notificações">
        {items.length > 0 && (
          <div className="mb-3 flex justify-end">
            <Button variant="ghost" size="sm" icon={<CheckCheck size={15} />} onClick={() => void markAllRead()}>
              Marcar todas como lidas
            </Button>
          </div>
        )}
        {items.length === 0 ? (
          <EmptyState
            icon={<Bell size={24} />}
            title="Nenhuma notificação"
            description="Você será avisado aqui sobre tarefas, prazos e aprovações."
          />
        ) : (
          <ul className="space-y-1.5">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => void markRead(n)}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
                    'hover:bg-[var(--color-surface-hover)]',
                    n.is_read
                      ? 'border-[var(--color-border)] opacity-70'
                      : 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]',
                  )}
                >
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-text-secondary)]">{n.body}</p>}
                  <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{formatRelative(n.created_at)}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Drawer>
    </>
  );
}
