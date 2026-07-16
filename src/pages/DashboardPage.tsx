import { useNavigate } from 'react-router-dom';
import { differenceInCalendarDays } from 'date-fns';
import {
  CalendarClock,
  CheckSquare,
  ChevronRight,
  Megaphone,
  PartyPopper,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@/hooks/useQuery';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, ProgressBar } from '@/components/ui/Card';
import { Badge, priorityTones } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/State';
import { computeSectorHealth, healthTone } from '@/utils/sectorHealth';
import { formatDate, formatDateTime, formatRelative } from '@/utils/format';
import { taskPriorityLabels } from '@/utils/labels';
import type { ActivityLog, CalendarEntry, Event, Sector, SectorGoal, Task } from '@/types';

interface DashboardData {
  nextEvent: Event | null;
  myTasks: Task[];
  nextMeeting: CalendarEntry | null;
  sectorSummary: { sector: Sector; score: number }[];
  activity: ActivityLog[];
}

export function DashboardPage() {
  const { profile, can } = useAuth();
  const navigate = useNavigate();
  const isExecutive = can('executive.view');
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const { data, loading, error, refetch } = useQuery<DashboardData>(async () => {
    const [nextEventRes, myTasksRes, meetingRes, sectorsRes, tasksRes, goalsRes, activityRes] = await Promise.all([
      supabase
        .from('events')
        .select('*')
        .gte('start_date', today)
        .not('status', 'in', '(cancelled,finished)')
        .order('start_date', { ascending: true })
        .limit(1)
        .maybeSingle(),
      profile
        ? supabase.from('task_assignees').select('task:tasks(*)').eq('profile_id', profile.id).limit(20)
        : Promise.resolve({ data: [] }),
      supabase
        .from('calendar_entries')
        .select('*')
        .eq('category', 'meeting')
        .gte('start_at', now)
        .order('start_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase.from('sectors').select('*').eq('is_active', true).order('name'),
      supabase.from('tasks').select('id, sector_id, status, due_date').eq('is_archived', false),
      supabase.from('sector_goals').select('id, sector_id, status, current_value, target_value'),
      supabase
        .from('activity_logs')
        .select('*, user:profiles(id, full_name)')
        .order('created_at', { ascending: false })
        .limit(6),
    ]);

    const sectors = (sectorsRes.data ?? []) as Sector[];
    const allTasks = (tasksRes.data ?? []) as Pick<Task, 'id' | 'sector_id' | 'status' | 'due_date'>[];
    const allGoals = (goalsRes.data ?? []) as Pick<SectorGoal, 'id' | 'sector_id' | 'status' | 'current_value' | 'target_value'>[];

    const myTasks = ((myTasksRes.data ?? []) as unknown as { task: Task | null }[])
      .map((r) => r.task)
      .filter((t): t is Task => t !== null && !t.is_archived && !['done', 'cancelled'].includes(t.status))
      .sort((a, b) => (a.due_date ?? '9999') < (b.due_date ?? '9999') ? -1 : 1)
      .slice(0, 6);

    const sectorSummary = sectors
      .map((s) => ({
        sector: s,
        score: computeSectorHealth({
          tasks: allTasks.filter((t) => t.sector_id === s.id),
          goals: allGoals.filter((g) => g.sector_id === s.id),
        }),
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 4);

    return {
      nextEvent: (nextEventRes.data as Event | null) ?? null,
      myTasks,
      nextMeeting: (meetingRes.data as CalendarEntry | null) ?? null,
      sectorSummary,
      activity: (activityRes.data ?? []) as ActivityLog[],
    };
  }, [profile?.id, today, now]);

  if (error) {
    return <ErrorState message={error} onRetry={() => void refetch()} />;
  }

  const firstName = profile?.nickname || profile?.full_name.split(' ')[0] || '';
  const daysToEvent = data?.nextEvent?.start_date
    ? differenceInCalendarDays(new Date(`${data.nextEvent.start_date}T00:00:00`), new Date())
    : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Olá, ${firstName}!`}
        description="Como está a Atlética hoje."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/pendencias')}>
              Central de Pendências
            </Button>
            {isExecutive && (
              <Button variant="outline" size="sm" onClick={() => navigate('/executivo')}>
                Dashboard Executivo
              </Button>
            )}
          </>
        }
      />

      {/* Banner do próximo evento */}
      {loading ? (
        <Card className="h-44 animate-shimmer" />
      ) : data?.nextEvent ? (
        <Card
          className="relative flex h-44 flex-col justify-end overflow-hidden p-5 text-white"
          style={{
            backgroundImage: data.nextEvent.cover_url
              ? `linear-gradient(to top, rgba(28,29,43,0.92), rgba(28,29,43,0.35)), url(${data.nextEvent.cover_url})`
              : 'linear-gradient(135deg, var(--color-primary), #454873)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-white/70">Próximo evento</p>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">{data.nextEvent.name}</h2>
              <p className="mt-1 text-sm text-white/80">
                {formatDate(data.nextEvent.start_date)}
                {data.nextEvent.location ? ` · ${data.nextEvent.location}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {daysToEvent !== null && (
                <span className="rounded-xl bg-white/15 px-3 py-1.5 text-center backdrop-blur-sm">
                  <span className="block text-xl font-bold leading-none">{daysToEvent === 0 ? 'Hoje' : daysToEvent}</span>
                  {daysToEvent > 0 && <span className="block text-[10px] uppercase text-white/70">dias</span>}
                </span>
              )}
              <Button onClick={() => navigate(`/eventos/${data.nextEvent!.id}`)}>Saiba mais</Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="flex h-24 items-center justify-between p-5">
          <p className="text-sm text-[var(--color-text-secondary)]">Nenhum evento futuro cadastrado.</p>
          <Button variant="outline" size="sm" onClick={() => navigate('/eventos')}>
            Ver eventos
          </Button>
        </Card>
      )}

      {/* Minhas tarefas / Próxima reunião / Resumo dos setores / Avisos */}
      <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex max-h-80 flex-col p-4 lg:max-h-none">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Minhas tarefas</h3>
            <button onClick={() => navigate('/tarefas?filtro=minhas')} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!loading && (data?.myTasks.length ?? 0) === 0 ? (
              <EmptyState icon={<CheckSquare size={20} />} title="Sem tarefas" description="Você está em dia." />
            ) : (
              <ul className="space-y-1.5">
                {(data?.myTasks ?? []).map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => navigate(`/tarefas?task=${t.id}`)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--color-surface-hover)]"
                    >
                      <span className="min-w-0 truncate text-sm">{t.title}</span>
                      <Badge tone={priorityTones[t.priority]}>{taskPriorityLabels[t.priority]}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="flex max-h-80 flex-col p-4 lg:max-h-none">
          <h3 className="mb-2 text-sm font-semibold">Próxima reunião</h3>
          {!loading && !data?.nextMeeting ? (
            <EmptyState icon={<CalendarClock size={20} />} title="Nada marcado" description="Sem reuniões agendadas." />
          ) : data?.nextMeeting ? (
            <button
              onClick={() => navigate('/calendario')}
              className="flex flex-1 flex-col justify-center rounded-lg px-2 text-left hover:bg-[var(--color-surface-hover)]"
            >
              <p className="text-sm font-medium">{data.nextMeeting.title}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{formatDateTime(data.nextMeeting.start_at)}</p>
            </button>
          ) : null}
        </Card>

        <Card className="flex max-h-80 flex-col p-4 lg:max-h-none">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Resumo dos setores</h3>
            <button onClick={() => navigate('/setores')} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="flex-1 space-y-2.5 overflow-y-auto">
            {!loading && (data?.sectorSummary.length ?? 0) === 0 ? (
              <EmptyState icon={<PartyPopper size={20} />} title="Sem setores" description="Crie setores em /setores." />
            ) : (
              (data?.sectorSummary ?? []).map((s) => (
                <button
                  key={s.sector.id}
                  onClick={() => navigate(`/setores/${s.sector.id}`)}
                  className="block w-full rounded-lg px-1 text-left hover:bg-[var(--color-surface-hover)]"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{s.sector.name}</span>
                    <Badge tone={healthTone(s.score)}>{s.score}%</Badge>
                  </div>
                  <ProgressBar value={s.score} />
                </button>
              ))
            )}
          </div>
        </Card>

        <Card className="flex max-h-80 flex-col p-4 lg:max-h-none">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Avisos</h3>
            <Megaphone size={15} className="text-[var(--color-text-muted)]" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {!loading && (data?.activity.length ?? 0) === 0 ? (
              <EmptyState title="Sem avisos" description="Novidades da Atlética aparecerão aqui." />
            ) : (
              <ul className="space-y-2">
                {(data?.activity ?? []).map((log) => (
                  <li key={log.id} className="text-sm">
                    <p className="line-clamp-2">
                      <span className="font-medium">{log.user?.full_name ?? 'Alguém'}</span>{' '}
                      <span className="text-[var(--color-text-secondary)]">{log.summary ?? `${log.action} em ${log.module}`}</span>
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">{formatRelative(log.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
