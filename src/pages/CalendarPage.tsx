import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useQuery } from '@/hooks/useQuery';
import type { CalendarCategory, CalendarEntry } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, FullPageSpinner } from '@/components/ui/State';
import { calendarCategoryColors, calendarCategoryLabels } from '@/utils/labels';
import { formatDate } from '@/utils/format';
import { cn } from '@/utils/cn';

type ViewMode = 'month' | 'week' | 'day' | 'agenda';

interface CalendarItem {
  id: string;
  title: string;
  date: string;
  category: CalendarCategory;
  source: 'entry' | 'event' | 'task' | 'training' | 'publication' | 'payment' | 'game';
  link?: string;
  entry?: CalendarEntry;
}

export function CalendarPage() {
  const navigate = useNavigate();
  const { profile, can } = useAuth();
  const toast = useToast();
  const canWrite = profile ? profile.role !== 'viewer' : false;
  const canFinance = can('finance.view');

  const [view, setView] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<CalendarEntry | null>(null);
  const [form, setForm] = useState({
    title: '',
    category: 'meeting' as CalendarCategory,
    date: '',
    time: '',
    description: '',
  });

  const items = useQuery<CalendarItem[]>(async () => {
    const [entries, events, tasks, trainings, publications, payments, games] = await Promise.all([
      supabase.from('calendar_entries').select('*'),
      supabase.from('events').select('id, name, start_date, status').not('start_date', 'is', null),
      supabase
        .from('tasks')
        .select('id, title, due_date, status')
        .not('due_date', 'is', null)
        .eq('is_archived', false)
        .not('status', 'in', '(done,cancelled)'),
      supabase.from('trainings').select('id, date, location, sport:sports(name)'),
      supabase.from('marketing_requests').select('id, title, publish_date').not('publish_date', 'is', null),
      canFinance
        ? supabase
            .from('financial_transactions')
            .select('id, description, due_date')
            .not('due_date', 'is', null)
            .eq('status', 'pending')
        : Promise.resolve({ data: [] }),
      supabase.from('games').select('id, date, opponent, sport:sports(name)'),
    ]);

    const list: CalendarItem[] = [];

    for (const e of (entries.data ?? []) as CalendarEntry[]) {
      list.push({
        id: `entry-${e.id}`,
        title: e.title,
        date: e.start_at.slice(0, 10),
        category: e.category,
        source: 'entry',
        entry: e,
      });
    }
    for (const ev of (events.data ?? []) as { id: string; name: string; start_date: string }[]) {
      list.push({
        id: `event-${ev.id}`,
        title: ev.name,
        date: ev.start_date,
        category: 'event',
        source: 'event',
        link: `/eventos/${ev.id}`,
      });
    }
    for (const t of (tasks.data ?? []) as { id: string; title: string; due_date: string }[]) {
      list.push({
        id: `task-${t.id}`,
        title: t.title,
        date: t.due_date,
        category: 'deadline',
        source: 'task',
        link: `/tarefas?task=${t.id}`,
      });
    }
    for (const tr of (trainings.data ?? []) as unknown as { id: string; date: string; sport: { name: string } | null }[]) {
      list.push({
        id: `training-${tr.id}`,
        title: `Treino${tr.sport?.name ? ` — ${tr.sport.name}` : ''}`,
        date: tr.date.slice(0, 10),
        category: 'training',
        source: 'training',
        link: '/esportes',
      });
    }
    for (const p of (publications.data ?? []) as { id: string; title: string; publish_date: string }[]) {
      list.push({
        id: `pub-${p.id}`,
        title: `Publicação: ${p.title}`,
        date: p.publish_date,
        category: 'publication',
        source: 'publication',
        link: '/marketing',
      });
    }
    for (const pay of (payments.data ?? []) as { id: string; description: string; due_date: string }[]) {
      list.push({
        id: `pay-${pay.id}`,
        title: `Vencimento: ${pay.description}`,
        date: pay.due_date,
        category: 'payment',
        source: 'payment',
        link: '/financeiro?tab=transactions',
      });
    }
    for (const g of (games.data ?? []) as unknown as { id: string; date: string; opponent: string | null; sport: { name: string } | null }[]) {
      list.push({
        id: `game-${g.id}`,
        title: `Jogo${g.sport?.name ? ` de ${g.sport.name}` : ''}${g.opponent ? ` × ${g.opponent}` : ''}`,
        date: g.date.slice(0, 10),
        category: 'game',
        source: 'game',
        link: '/esportes',
      });
    }

    return list.sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [canFinance]);

  const filtered = useMemo(
    () => (items.data ?? []).filter((i) => !categoryFilter || i.category === categoryFilter),
    [items.data, categoryFilter],
  );

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end: addDays(start, 6) });
  }, [cursor]);

  const itemsOn = (day: Date) => filtered.filter((i) => isSameDay(parseISO(i.date), day));

  const navigateCursor = (dir: 1 | -1) => {
    setCursor((c) => {
      if (view === 'month') return addMonths(c, dir);
      if (view === 'week') return addWeeks(c, dir);
      return addDays(c, dir);
    });
  };

  const openItem = (item: CalendarItem) => {
    if (item.source === 'entry' && item.entry && canWrite) {
      setDeletingEntry(item.entry);
    } else if (item.link) {
      navigate(item.link);
    }
  };

  const createEntry = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.title.trim() || !form.date) {
      toast.error('Informe título e data do compromisso.');
      return;
    }
    setSaving(true);
    const startAt = form.time ? `${form.date}T${form.time}:00` : `${form.date}T09:00:00`;
    const { error } = await supabase.from('calendar_entries').insert({
      title: form.title.trim(),
      category: form.category,
      start_at: new Date(startAt).toISOString(),
      all_day: !form.time,
      description: form.description.trim() || null,
      created_by: profile?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    toast.success('Compromisso criado.');
    setModalOpen(false);
    setForm({ title: '', category: 'meeting', date: '', time: '', description: '' });
    void items.refetch();
  };

  const deleteEntry = async () => {
    if (!deletingEntry) return;
    const { error } = await supabase.from('calendar_entries').delete().eq('id', deletingEntry.id);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    toast.success('Compromisso excluído.');
    setDeletingEntry(null);
    void items.refetch();
  };

  const ItemChip = ({ item }: { item: CalendarItem }) => (
    <button
      onClick={() => openItem(item)}
      title={item.title}
      className="block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium text-white hover:opacity-85"
      style={{ backgroundColor: calendarCategoryColors[item.category] }}
    >
      {item.title}
    </button>
  );

  const headerLabel =
    view === 'month'
      ? format(cursor, 'MMMM yyyy', { locale: ptBR })
      : view === 'week'
        ? `Semana de ${format(startOfWeek(cursor, { weekStartsOn: 0 }), 'dd/MM')}`
        : view === 'day'
          ? format(cursor, "EEEE, dd 'de' MMMM", { locale: ptBR })
          : 'Agenda';

  return (
    <div>
      <PageHeader
        title="Calendário"
        description="Eventos, treinos, jogos, prazos, publicações e vencimentos em um só lugar."
        breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Calendário' }]}
        actions={
          canWrite && (
            <Button icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
              Novo compromisso
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-[var(--color-border)] p-0.5">
          {(['month', 'week', 'day', 'agenda'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium capitalize',
                view === mode
                  ? 'bg-[var(--color-surface-secondary)] text-[var(--color-text)]'
                  : 'text-[var(--color-text-secondary)]',
              )}
            >
              {mode === 'month' ? 'Mês' : mode === 'week' ? 'Semana' : mode === 'day' ? 'Dia' : 'Agenda'}
            </button>
          ))}
        </div>

        {view !== 'agenda' && (
          <div className="flex items-center gap-1">
            <IconButton label="Período anterior" size="sm" variant="outline" onClick={() => navigateCursor(-1)}>
              <ChevronLeft size={16} />
            </IconButton>
            <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>
              Hoje
            </Button>
            <IconButton label="Próximo período" size="sm" variant="outline" onClick={() => navigateCursor(1)}>
              <ChevronRight size={16} />
            </IconButton>
          </div>
        )}

        <span className="text-sm font-semibold capitalize">{headerLabel}</span>

        <Select
          aria-label="Filtrar por categoria"
          options={Object.entries(calendarCategoryLabels).map(([value, label]) => ({ value, label }))}
          placeholder="Todas as categorias"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="ml-auto w-full sm:w-48"
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(calendarCategoryLabels) as CalendarCategory[]).map((cat) => (
          <span key={cat} className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: calendarCategoryColors[cat] }} />
            {calendarCategoryLabels[cat]}
          </span>
        ))}
      </div>

      {items.error ? (
        <ErrorState message={items.error} onRetry={() => void items.refetch()} />
      ) : items.loading ? (
        <FullPageSpinner />
      ) : view === 'month' ? (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 gap-px bg-[var(--color-border)]">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
              <div key={d} className="bg-[var(--color-surface-secondary)] px-1 py-1.5 text-center text-xs font-medium text-[var(--color-text-secondary)]">
                {d}
              </div>
            ))}
            {monthDays.map((day) => {
              const dayItems = itemsOn(day);
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={day.toISOString()}
                  className={cn('min-h-24 bg-[var(--color-surface)] p-1', !isSameMonth(day, cursor) && 'opacity-40')}
                >
                  <p
                    className={cn(
                      'mb-0.5 ml-auto flex h-5 w-5 items-center justify-center rounded-full text-[11px]',
                      isToday ? 'bg-[var(--color-primary)] font-bold text-white' : 'text-[var(--color-text-muted)]',
                    )}
                  >
                    {format(day, 'd')}
                  </p>
                  <div className="space-y-0.5">
                    {dayItems.slice(0, 3).map((item) => (
                      <ItemChip key={item.id} item={item} />
                    ))}
                    {dayItems.length > 3 && (
                      <p className="text-[10px] text-[var(--color-text-muted)]">+{dayItems.length - 3}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : view === 'week' ? (
        <div className="grid gap-2 md:grid-cols-7">
          {weekDays.map((day) => {
            const dayItems = itemsOn(day);
            const isToday = isSameDay(day, new Date());
            return (
              <Card key={day.toISOString()} className={cn('p-2', isToday && 'border-[var(--color-primary)]')}>
                <p className="mb-1.5 text-xs font-semibold capitalize">
                  {format(day, 'EEE dd/MM', { locale: ptBR })}
                </p>
                <div className="space-y-1">
                  {dayItems.length === 0 ? (
                    <p className="text-[11px] text-[var(--color-text-muted)]">—</p>
                  ) : (
                    dayItems.map((item) => <ItemChip key={item.id} item={item} />)
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : view === 'day' ? (
        <Card className="p-4">
          {itemsOn(cursor).length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={24} />}
              title="Nada agendado para este dia"
              description="Crie um compromisso ou navegue para outro dia."
            />
          ) : (
            <ul className="space-y-2">
              {itemsOn(cursor).map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => openItem(item)}
                    className="flex w-full items-center gap-3 rounded-lg border border-[var(--color-border)] px-3 py-2.5 text-left hover:bg-[var(--color-surface-hover)]"
                  >
                    <span aria-hidden className="h-3 w-3 rounded-full" style={{ backgroundColor: calendarCategoryColors[item.category] }} />
                    <span className="flex-1 text-sm font-medium">{item.title}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{calendarCategoryLabels[item.category]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <Card className="p-4">
          {filtered.filter((i) => i.date >= format(new Date(), 'yyyy-MM-dd')).length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={24} />}
              title="Agenda vazia"
              description="Os próximos compromissos aparecerão aqui."
            />
          ) : (
            <ul className="space-y-2">
              {filtered
                .filter((i) => i.date >= format(new Date(), 'yyyy-MM-dd'))
                .slice(0, 40)
                .map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => openItem(item)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[var(--color-surface-hover)]"
                    >
                      <span className="w-20 shrink-0 text-xs font-semibold text-[var(--color-text-secondary)]">
                        {formatDate(item.date, 'dd/MM')}
                      </span>
                      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: calendarCategoryColors[item.category] }} />
                      <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                      <span className="hidden text-xs text-[var(--color-text-muted)] sm:block">
                        {calendarCategoryLabels[item.category]}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Novo compromisso"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={(e) => void createEntry(e as unknown as FormEvent)}>
              Criar
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => void createEntry(e)} className="grid gap-4">
          <Input label="Título" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Select
            label="Categoria"
            options={Object.entries(calendarCategoryLabels).map(([value, label]) => ({ value, label }))}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as CalendarCategory })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Data" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <Input label="Hora (opcional)" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </div>
          <Textarea label="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </form>
      </Modal>

      <ConfirmModal
        open={deletingEntry !== null}
        onClose={() => setDeletingEntry(null)}
        onConfirm={deleteEntry}
        title="Excluir compromisso"
        message={`Excluir "${deletingEntry?.title ?? ''}" do calendário?`}
        confirmLabel="Excluir"
      />
    </div>
  );
}
