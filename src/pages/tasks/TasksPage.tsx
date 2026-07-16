import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, KanbanSquare, List, CalendarDays, GanttChartSquare, CheckSquare } from 'lucide-react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
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
import { useDebounce } from '@/hooks/useDebounce';
import type { Sector, Event, Profile, Task, TaskStatus } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Select, SearchInput } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge, priorityTones, taskStatusTones } from '@/components/ui/Badge';
import { AvatarGroup } from '@/components/ui/Avatar';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/State';
import { TaskBoard } from '@/pages/tasks/TaskBoard';
import { TaskModal } from '@/pages/tasks/TaskModal';
import { generateNextOccurrence } from '@/services/recurrence';
import { taskPriorityLabels, taskStatusLabels, taskStatusOrder } from '@/utils/labels';
import { formatDate, isOverdue, todayISO } from '@/utils/format';
import { cn } from '@/utils/cn';

type ViewMode = 'kanban' | 'list' | 'calendar' | 'timeline';

export function TasksPage() {
  const { profile, can } = useAuth();
  const toast = useToast();
  const canManage = can('tasks.manage');
  const [searchParams, setSearchParams] = useSearchParams();

  const [view, setView] = useState<ViewMode>('kanban');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sectorFilter, setDepartmentFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState(searchParams.get('filtro') ?? '');
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const debouncedSearch = useDebounce(search);

  const departments = useQuery<Sector[]>(async () => {
    const { data } = await supabase.from('sectors').select('*').eq('is_active', true).order('name');
    return (data ?? []) as Sector[];
  });

  const profiles = useQuery<Profile[]>(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('is_active', true).order('full_name');
    return (data ?? []) as Profile[];
  });

  const events = useQuery<Pick<Event, 'id' | 'name'>[]>(async () => {
    const { data } = await supabase.from('events').select('id, name').order('start_date', { ascending: false });
    return (data ?? []) as Pick<Event, 'id' | 'name'>[];
  });

  const favorites = useQuery<Set<string>>(async () => {
    if (!profile) return new Set();
    const { data } = await supabase.from('task_favorites').select('task_id').eq('profile_id', profile.id);
    return new Set((data ?? []).map((f) => f.task_id as string));
  }, [profile?.id]);

  const tasks = useQuery<Task[]>(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select(
        '*, sector:sectors(*), event:events(id, name), assignees:task_assignees(task_id, profile_id, created_at, profile:profiles(id, full_name, avatar_url))',
      )
      .eq('is_archived', false)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Task[];
  });

  useEffect(() => {
    const taskId = searchParams.get('task');
    if (taskId && tasks.data) {
      const found = tasks.data.find((t) => t.id === taskId);
      if (found) {
        setSelectedTask(found);
        setModalOpen(true);
        searchParams.delete('task');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, tasks.data, setSearchParams]);

  const filtered = useMemo(() => {
    const today = todayISO();
    return (tasks.data ?? []).filter((t) => {
      if (debouncedSearch && !t.title.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (sectorFilter && t.sector_id !== sectorFilter) return false;
      if (eventFilter && t.event_id !== eventFilter) return false;
      if (scopeFilter === 'atrasadas') {
        if (!t.due_date || t.due_date >= today || ['done', 'cancelled'].includes(t.status)) return false;
      }
      if (scopeFilter === 'minhas' && !(t.assignees ?? []).some((a) => a.profile_id === profile?.id)) return false;
      if (scopeFilter === 'criadas' && t.created_by !== profile?.id) return false;
      if (scopeFilter === 'favoritas' && !favorites.data?.has(t.id)) return false;
      return true;
    });
  }, [tasks.data, debouncedSearch, statusFilter, priorityFilter, sectorFilter, eventFilter, scopeFilter, profile?.id, favorites.data]);

  const moveTask = async (taskId: string, status: TaskStatus) => {
    const task = tasks.data?.find((t) => t.id === taskId);
    if (!task || task.status === status) return;
    const { error } = await supabase
      .from('tasks')
      .update({ status, completed_at: status === 'done' ? new Date().toISOString() : null })
      .eq('id', taskId);
    if (error) {
      toast.error(`Erro ao mover tarefa: ${error.message}`);
      return;
    }
    if (status === 'done' && task.recurrence_type) {
      void generateNextOccurrence(task);
    }
    void tasks.refetch();
  };

  const openTask = (task: Task) => {
    setSelectedTask(task);
    setModalOpen(true);
  };

  const openCreate = () => {
    setSelectedTask(null);
    setModalOpen(true);
  };

  const columns: Column<Task>[] = [
    {
      key: 'title',
      header: 'Tarefa',
      render: (t) => (
        <span>
          <span className={cn('block font-medium', t.status === 'done' && 'line-through opacity-60')}>{t.title}</span>
          {t.event?.name && <span className="text-xs text-[var(--color-text-muted)]">{t.event.name}</span>}
        </span>
      ),
    },
    { key: 'sector', header: 'Setor', render: (t) => t.sector?.name ?? '—', hideOnMobile: true },
    {
      key: 'assignees',
      header: 'Responsáveis',
      hideOnMobile: true,
      render: (t) =>
        (t.assignees ?? []).length > 0 ? (
          <AvatarGroup
            size="xs"
            people={(t.assignees ?? []).map((a) => ({ name: a.profile?.full_name ?? '?', src: a.profile?.avatar_url }))}
          />
        ) : (
          '—'
        ),
    },
    {
      key: 'due',
      header: 'Prazo',
      render: (t) => (
        <span className={cn(isOverdue(t.due_date) && !['done', 'cancelled'].includes(t.status) && 'font-semibold text-[var(--color-danger)]')}>
          {formatDate(t.due_date)}
        </span>
      ),
    },
    {
      key: 'priority',
      header: 'Prioridade',
      hideOnMobile: true,
      render: (t) => <Badge tone={priorityTones[t.priority]}>{taskPriorityLabels[t.priority]}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => <Badge tone={taskStatusTones[t.status]}>{taskStatusLabels[t.status]}</Badge>,
    },
  ];

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [calendarMonth]);

  const timelineGroups = useMemo(() => {
    const withDue = filtered
      .filter((t) => t.due_date)
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
    const groups = new Map<string, Task[]>();
    for (const t of withDue) {
      const weekStart = format(startOfWeek(parseISO(t.due_date!), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      groups.set(weekStart, [...(groups.get(weekStart) ?? []), t]);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  const viewButtons: { mode: ViewMode; label: string; icon: typeof KanbanSquare }[] = [
    { mode: 'kanban', label: 'Kanban', icon: KanbanSquare },
    { mode: 'list', label: 'Lista', icon: List },
    { mode: 'calendar', label: 'Calendário', icon: CalendarDays },
    { mode: 'timeline', label: 'Timeline', icon: GanttChartSquare },
  ];

  return (
    <div>
      <PageHeader
        title="Tarefas"
        description="Organize e acompanhe as demandas de todos os setores."
        breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Tarefas' }]}
        actions={
          <>
            <div className="flex rounded-lg border border-[var(--color-border)] p-0.5">
              {viewButtons.map((v) => (
                <IconButton
                  key={v.mode}
                  label={`Visualizar em ${v.label}`}
                  size="sm"
                  variant={view === v.mode ? 'secondary' : 'ghost'}
                  onClick={() => setView(v.mode)}
                >
                  <v.icon size={16} />
                </IconButton>
              ))}
            </div>
            {canManage && (
              <Button icon={<Plus size={16} />} onClick={openCreate}>
                Nova tarefa
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <SearchInput
          placeholder="Buscar tarefa…"
          aria-label="Buscar tarefa"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          containerClassName="col-span-2 sm:w-56"
        />
        <Select
          aria-label="Filtrar por status"
          options={taskStatusOrder.map((s) => ({ value: s, label: taskStatusLabels[s] }))}
          placeholder="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="sm:w-40"
        />
        <Select
          aria-label="Filtrar por prioridade"
          options={Object.entries(taskPriorityLabels).map(([value, label]) => ({ value, label }))}
          placeholder="Prioridade"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="sm:w-40"
        />
        <Select
          aria-label="Filtrar por setor"
          options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
          placeholder="Setor"
          value={sectorFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="sm:w-44"
        />
        <Select
          aria-label="Filtrar por evento"
          options={(events.data ?? []).map((ev) => ({ value: ev.id, label: ev.name }))}
          placeholder="Evento"
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="sm:w-44"
        />
        <Select
          aria-label="Filtro rápido"
          options={[
            { value: 'atrasadas', label: 'Atrasadas' },
            { value: 'minhas', label: 'Atribuídas a mim' },
            { value: 'criadas', label: 'Criadas por mim' },
            { value: 'favoritas', label: 'Favoritas' },
          ]}
          placeholder="Todas"
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value)}
          className="sm:w-44"
        />
      </div>

      {tasks.error ? (
        <ErrorState message={tasks.error} onRetry={() => void tasks.refetch()} />
      ) : tasks.loading ? (
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-72" />
          ))}
        </div>
      ) : filtered.length === 0 && (tasks.data ?? []).length === 0 ? (
        <EmptyState
          icon={<CheckSquare size={24} />}
          title="Você ainda não possui tarefas cadastradas"
          description="Crie a primeira tarefa para começar a organizar sua Atlética."
          actionLabel={canManage ? 'Criar tarefa' : undefined}
          onAction={canManage ? openCreate : undefined}
        />
      ) : view === 'kanban' ? (
        <div key={view} className="animate-fade-in">
          <TaskBoard tasks={filtered} onMoveTask={(id, s) => void moveTask(id, s)} onOpenTask={openTask} canManage={canManage} />
        </div>
      ) : view === 'list' ? (
        <Card key={view} className="animate-fade-in">
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(t) => t.id}
            onRowClick={openTask}
            emptyState={<EmptyState title="Nenhuma tarefa encontrada" description="Ajuste os filtros para ver resultados." />}
          />
        </Card>
      ) : view === 'calendar' ? (
        <Card key={view} className="animate-fade-in p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold capitalize">{format(calendarMonth, 'MMMM yyyy', { locale: ptBR })}</h3>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setCalendarMonth((m) => addMonths(m, -1))}>
                Anterior
              </Button>
              <Button size="sm" variant="outline" onClick={() => setCalendarMonth(startOfMonth(new Date()))}>
                Hoje
              </Button>
              <Button size="sm" variant="outline" onClick={() => setCalendarMonth((m) => addMonths(m, 1))}>
                Próximo
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-border)]">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
              <div key={d} className="bg-[var(--color-surface-secondary)] px-1 py-1.5 text-center text-xs font-medium text-[var(--color-text-secondary)]">
                {d}
              </div>
            ))}
            {calendarDays.map((day) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const dayTasks = filtered.filter((t) => t.due_date === dayStr);
              return (
                <div
                  key={dayStr}
                  className={cn(
                    'min-h-20 bg-[var(--color-surface)] p-1',
                    !isSameMonth(day, calendarMonth) && 'opacity-40',
                  )}
                >
                  <p className="mb-0.5 text-right text-[11px] text-[var(--color-text-muted)]">{format(day, 'd')}</p>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => openTask(t)}
                        className="block w-full truncate rounded bg-[var(--color-primary-soft)] px-1 py-0.5 text-left text-[10px] text-[var(--color-primary)] hover:opacity-80"
                        title={t.title}
                      >
                        {t.title}
                      </button>
                    ))}
                    {dayTasks.length > 3 && (
                      <p className="text-[10px] text-[var(--color-text-muted)]">+{dayTasks.length - 3}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <div key={view} className="animate-fade-in space-y-4">
          {timelineGroups.length === 0 ? (
            <EmptyState title="Sem tarefas com prazo" description="Defina prazos para visualizar a timeline." />
          ) : (
            timelineGroups.map(([weekStart, weekTasks]) => (
              <Card key={weekStart} className="p-4">
                <h3 className="mb-2 text-sm font-semibold">
                  Semana de {formatDate(weekStart, "dd 'de' MMMM")}
                </h3>
                <ol className="relative space-y-2 border-l-2 border-[var(--color-border)] pl-4">
                  {weekTasks.map((t) => (
                    <li key={t.id} className="relative">
                      <span
                        aria-hidden
                        className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]"
                      />
                      <button onClick={() => openTask(t)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--color-surface-hover)]">
                        <span>
                          <span className="block text-sm font-medium">{t.title}</span>
                          <span className="text-xs text-[var(--color-text-muted)]">{formatDate(t.due_date)}</span>
                        </span>
                        <Badge tone={taskStatusTones[t.status]}>{taskStatusLabels[t.status]}</Badge>
                      </button>
                    </li>
                  ))}
                </ol>
              </Card>
            ))
          )}
        </div>
      )}

      <TaskModal
        open={modalOpen}
        task={selectedTask}
        profiles={profiles.data ?? []}
        departments={departments.data ?? []}
        events={events.data ?? []}
        onClose={() => {
          setModalOpen(false);
          void favorites.refetch();
        }}
        onSaved={() => void tasks.refetch()}
      />
    </div>
  );
}
