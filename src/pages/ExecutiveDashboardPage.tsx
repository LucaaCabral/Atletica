import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/hooks/useQuery';
import type { Event, Sector, SectorGoal, Task } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, KpiCard, ProgressBar } from '@/components/ui/Card';
import { Badge, eventStatusTones } from '@/components/ui/Badge';
import { ChartCard, chartTooltipStyle } from '@/components/charts/ChartCard';
import { EmptyState, ErrorState } from '@/components/ui/State';
import { computeSectorHealth, healthTone } from '@/utils/sectorHealth';
import { formatDate, todayISO } from '@/utils/format';
import { eventStatusLabels } from '@/utils/labels';
import { PartyPopper, CheckSquare, AlertTriangle, Layers } from 'lucide-react';

interface SectorHealthRow {
  sector: Sector;
  score: number;
  openTasks: number;
  overdueTasks: number;
}

export function ExecutiveDashboardPage() {
  const navigate = useNavigate();
  const today = todayISO();

  const data = useQuery<{
    rows: SectorHealthRow[];
    upcomingEvents: Event[];
    totalOpenTasks: number;
    totalOverdueTasks: number;
  }>(async () => {
    const [sectorsRes, tasksRes, goalsRes, eventsRes] = await Promise.all([
      supabase.from('sectors').select('*').eq('is_active', true).order('name'),
      supabase.from('tasks').select('id, sector_id, status, due_date').eq('is_archived', false),
      supabase.from('sector_goals').select('id, sector_id, status, current_value, target_value'),
      supabase
        .from('events')
        .select('*')
        .gte('start_date', today)
        .not('status', 'in', '(cancelled,finished)')
        .order('start_date', { ascending: true })
        .limit(6),
    ]);

    const sectors = (sectorsRes.data ?? []) as Sector[];
    const tasks = (tasksRes.data ?? []) as Pick<Task, 'id' | 'sector_id' | 'status' | 'due_date'>[];
    const goals = (goalsRes.data ?? []) as Pick<SectorGoal, 'id' | 'sector_id' | 'status' | 'current_value' | 'target_value'>[];

    const rows: SectorHealthRow[] = sectors.map((s) => {
      const sectorTasks = tasks.filter((t) => t.sector_id === s.id);
      const sectorGoals = goals.filter((g) => g.sector_id === s.id);
      const openTasks = sectorTasks.filter((t) => !['done', 'cancelled'].includes(t.status));
      const overdueTasks = openTasks.filter((t) => t.due_date && t.due_date < today);
      return {
        sector: s,
        score: computeSectorHealth({ tasks: sectorTasks, goals: sectorGoals }),
        openTasks: openTasks.length,
        overdueTasks: overdueTasks.length,
      };
    });
    rows.sort((a, b) => a.score - b.score);

    return {
      rows,
      upcomingEvents: (eventsRes.data ?? []) as Event[],
      totalOpenTasks: tasks.filter((t) => !['done', 'cancelled'].includes(t.status)).length,
      totalOverdueTasks: tasks.filter((t) => !['done', 'cancelled'].includes(t.status) && t.due_date && t.due_date < today).length,
    };
  }, [today]);

  if (data.error) return <ErrorState message={data.error} onRetry={() => void data.refetch()} />;

  const chartData = (data.data?.rows ?? []).map((r) => ({ name: r.sector.name, abertas: r.openTasks, atrasadas: r.overdueTasks }));

  return (
    <div>
      <PageHeader
        title="Dashboard Executivo"
        description="Visão de presidência: saúde dos setores, carga de trabalho e eventos."
        breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Dashboard Executivo' }]}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard title="Setores ativos" value={data.data?.rows.length ?? 0} icon={<Layers size={18} />} loading={data.loading} />
        <KpiCard title="Tarefas em aberto" value={data.data?.totalOpenTasks ?? 0} icon={<CheckSquare size={18} />} loading={data.loading} />
        <KpiCard
          title="Tarefas atrasadas"
          value={data.data?.totalOverdueTasks ?? 0}
          icon={<AlertTriangle size={18} />}
          tone={data.data && data.data.totalOverdueTasks > 0 ? 'danger' : 'default'}
          loading={data.loading}
          onClick={() => navigate('/pendencias')}
        />
        <KpiCard title="Próximos eventos" value={data.data?.upcomingEvents.length ?? 0} icon={<PartyPopper size={18} />} loading={data.loading} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Saúde dos setores</h3>
          {!data.loading && (data.data?.rows.length ?? 0) === 0 ? (
            <EmptyState title="Nenhum setor" description="Crie setores para acompanhar a saúde de cada um." />
          ) : (
            <ul className="space-y-3">
              {(data.data?.rows ?? []).map((r) => (
                <li key={r.sector.id}>
                  <button
                    onClick={() => navigate(`/setores/${r.sector.id}`)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left hover:bg-[var(--color-surface-hover)]"
                  >
                    <span className="text-sm font-medium">{r.sector.name}</span>
                    <Badge tone={healthTone(r.score)}>{r.score}%</Badge>
                  </button>
                  <ProgressBar value={r.score} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <ChartCard title="Carga de trabalho por setor" subtitle="Tarefas em aberto x atrasadas" loading={data.loading}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="abertas" name="Em aberto" fill="var(--color-secondary)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="atrasadas" name="Atrasadas" fill="var(--color-danger)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <Card className="mt-4 p-4">
        <h3 className="mb-3 text-sm font-semibold">Próximos eventos</h3>
        {!data.loading && (data.data?.upcomingEvents.length ?? 0) === 0 ? (
          <EmptyState title="Nenhum evento futuro" description="Eventos confirmados aparecerão aqui." />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(data.data?.upcomingEvents ?? []).map((ev) => (
              <li key={ev.id}>
                <button
                  onClick={() => navigate(`/eventos/${ev.id}`)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-[var(--color-surface-hover)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{ev.name}</span>
                    <span className="block text-xs text-[var(--color-text-muted)]">{formatDate(ev.start_date)}</span>
                  </span>
                  <Badge tone={eventStatusTones[ev.status]}>{eventStatusLabels[ev.status]}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
