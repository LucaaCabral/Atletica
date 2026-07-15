import { useNavigate } from 'react-router-dom';
import {
  PartyPopper,
  CheckSquare,
  AlertTriangle,
  Wallet,
  TrendingUp,
  TrendingDown,
  Trophy,
  BadgeCheck,
  Handshake,
  Hourglass,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { format, startOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@/hooks/useQuery';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard, Card } from '@/components/ui/Card';
import { Badge, taskStatusTones, priorityTones, eventStatusTones } from '@/components/ui/Badge';
import { EmptyState, ErrorState } from '@/components/ui/State';
import { ChartCard, chartTooltipStyle } from '@/components/charts/ChartCard';
import { formatCurrency, formatDate, todayISO, formatRelative } from '@/utils/format';
import { taskStatusLabels, taskPriorityLabels, eventStatusLabels } from '@/utils/labels';
import type { ActivityLog, Event, Task, TransactionType } from '@/types';

interface DashboardData {
  activeEvents: number;
  pendingTasks: number;
  overdueTasks: number;
  awaitingApproval: number;
  balance: number | null;
  monthIncome: number | null;
  monthExpense: number | null;
  athletes: number;
  clubMembers: number;
  sponsors: number;
  upcomingEvents: Event[];
  priorityTasks: Task[];
  tasksByStatus: { status: string; total: number }[];
  monthlyFinance: { month: string; receitas: number; despesas: number }[];
  recentActivity: ActivityLog[];
}

const OPEN_TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'in_review'];

export function DashboardPage() {
  const { profile, can } = useAuth();
  const navigate = useNavigate();
  const canFinance = can('finance.view');
  const today = todayISO();

  const { data, loading, error, refetch } = useQuery<DashboardData>(async () => {
    const [
      activeEvents,
      pendingTasks,
      overdueTasks,
      reviewTasks,
      marketingApprovals,
      athletes,
      clubMembers,
      sponsors,
      upcoming,
      priority,
      allTasks,
      logs,
    ] = await Promise.all([
      supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .in('status', ['planning', 'preparing', 'confirmed', 'ongoing']),
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .in('status', OPEN_TASK_STATUSES)
        .eq('is_archived', false),
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .in('status', OPEN_TASK_STATUSES)
        .eq('is_archived', false)
        .lt('due_date', today),
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'in_review')
        .eq('is_archived', false),
      supabase
        .from('marketing_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'awaiting_approval'),
      supabase.from('athletes').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('members_club').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('sponsors').select('id', { count: 'exact', head: true }).in('status', ['closed', 'renewal']),
      supabase
        .from('events')
        .select('*')
        .gte('start_date', today)
        .not('status', 'in', '(cancelled,finished)')
        .order('start_date', { ascending: true })
        .limit(5),
      supabase
        .from('tasks')
        .select('*')
        .in('status', OPEN_TASK_STATUSES)
        .in('priority', ['high', 'urgent'])
        .eq('is_archived', false)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(6),
      supabase.from('tasks').select('status').eq('is_archived', false),
      supabase
        .from('activity_logs')
        .select('*, user:profiles(id, full_name)')
        .order('created_at', { ascending: false })
        .limit(8),
    ]);

    let balance: number | null = null;
    let monthIncome: number | null = null;
    let monthExpense: number | null = null;
    let monthlyFinance: DashboardData['monthlyFinance'] = [];

    if (canFinance) {
      const sixMonthsAgo = format(startOfMonth(subMonths(new Date(), 5)), 'yyyy-MM-dd');
      const { data: txs } = await supabase
        .from('financial_transactions')
        .select('type, amount, date, status')
        .neq('status', 'cancelled');

      const list = (txs ?? []) as { type: TransactionType; amount: number; date: string; status: string }[];
      const paid = list.filter((t) => t.status === 'paid');
      balance =
        paid.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0) -
        paid.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      monthIncome = list
        .filter((t) => t.type === 'income' && t.date >= monthStart)
        .reduce((s, t) => s + Number(t.amount), 0);
      monthExpense = list
        .filter((t) => t.type === 'expense' && t.date >= monthStart)
        .reduce((s, t) => s + Number(t.amount), 0);

      const byMonth = new Map<string, { receitas: number; despesas: number }>();
      for (let i = 5; i >= 0; i -= 1) {
        const key = format(subMonths(new Date(), i), 'yyyy-MM');
        byMonth.set(key, { receitas: 0, despesas: 0 });
      }
      for (const t of list) {
        if (t.date < sixMonthsAgo) continue;
        const key = t.date.slice(0, 7);
        const bucket = byMonth.get(key);
        if (!bucket) continue;
        if (t.type === 'income') bucket.receitas += Number(t.amount);
        else bucket.despesas += Number(t.amount);
      }
      monthlyFinance = Array.from(byMonth.entries()).map(([key, v]) => ({
        month: format(new Date(`${key}-15`), 'MMM', { locale: ptBR }),
        ...v,
      }));
    }

    const statusCount = new Map<string, number>();
    for (const t of (allTasks.data ?? []) as { status: string }[]) {
      statusCount.set(t.status, (statusCount.get(t.status) ?? 0) + 1);
    }
    const tasksByStatus = Array.from(statusCount.entries()).map(([status, total]) => ({
      status: taskStatusLabels[status as keyof typeof taskStatusLabels] ?? status,
      total,
    }));

    return {
      activeEvents: activeEvents.count ?? 0,
      pendingTasks: pendingTasks.count ?? 0,
      overdueTasks: overdueTasks.count ?? 0,
      awaitingApproval: (reviewTasks.count ?? 0) + (marketingApprovals.count ?? 0),
      balance,
      monthIncome,
      monthExpense,
      athletes: athletes.count ?? 0,
      clubMembers: clubMembers.count ?? 0,
      sponsors: sponsors.count ?? 0,
      upcomingEvents: (upcoming.data ?? []) as Event[],
      priorityTasks: (priority.data ?? []) as Task[],
      tasksByStatus,
      monthlyFinance,
      recentActivity: (logs.data ?? []) as ActivityLog[],
    };
  }, [canFinance]);

  if (error) {
    return <ErrorState message={error} onRetry={() => void refetch()} />;
  }

  const firstName = profile?.nickname || profile?.full_name.split(' ')[0] || '';

  return (
    <div>
      <PageHeader
        title={`Olá, ${firstName}!`}
        description="Visão geral da Atlética em tempo real."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          title="Eventos ativos"
          value={data?.activeEvents ?? 0}
          icon={<PartyPopper size={18} />}
          loading={loading}
          onClick={() => navigate('/eventos')}
        />
        <KpiCard
          title="Tarefas pendentes"
          value={data?.pendingTasks ?? 0}
          icon={<CheckSquare size={18} />}
          loading={loading}
          onClick={() => navigate('/tarefas')}
        />
        <KpiCard
          title="Tarefas atrasadas"
          value={data?.overdueTasks ?? 0}
          icon={<AlertTriangle size={18} />}
          tone={data && data.overdueTasks > 0 ? 'danger' : 'default'}
          loading={loading}
          onClick={() => navigate('/tarefas?filtro=atrasadas')}
        />
        <KpiCard
          title="Aguardando aprovação"
          value={data?.awaitingApproval ?? 0}
          icon={<Hourglass size={18} />}
          tone="warning"
          loading={loading}
          onClick={() => navigate('/tarefas?status=in_review')}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {canFinance && (
          <>
            <KpiCard
              title="Saldo atual"
              value={formatCurrency(data?.balance)}
              icon={<Wallet size={18} />}
              tone={data && (data.balance ?? 0) < 0 ? 'danger' : 'success'}
              loading={loading}
              onClick={() => navigate('/financeiro')}
            />
            <KpiCard
              title="Receitas do mês"
              value={formatCurrency(data?.monthIncome)}
              icon={<TrendingUp size={18} />}
              tone="success"
              loading={loading}
              onClick={() => navigate('/financeiro?tipo=income')}
            />
            <KpiCard
              title="Despesas do mês"
              value={formatCurrency(data?.monthExpense)}
              icon={<TrendingDown size={18} />}
              tone="danger"
              loading={loading}
              onClick={() => navigate('/financeiro?tipo=expense')}
            />
          </>
        )}
        <KpiCard
          title="Atletas ativos"
          value={data?.athletes ?? 0}
          icon={<Trophy size={18} />}
          loading={loading}
          onClick={() => navigate('/esportes')}
        />
        <KpiCard
          title="Sócios ativos"
          value={data?.clubMembers ?? 0}
          icon={<BadgeCheck size={18} />}
          loading={loading}
          onClick={() => navigate('/socios')}
        />
        <KpiCard
          title="Patrocinadores"
          value={data?.sponsors ?? 0}
          icon={<Handshake size={18} />}
          loading={loading}
          onClick={() => navigate('/patrocinadores')}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {canFinance && (
          <ChartCard title="Receitas × Despesas" subtitle="Últimos 6 meses" loading={loading}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.monthlyFinance ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} width={70} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="receitas" name="Receitas" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="var(--color-danger)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        )}

        <ChartCard title="Tarefas por status" loading={loading}>
          <div className="h-64">
            {data && data.tasksByStatus.length === 0 ? (
              <EmptyState title="Sem tarefas ainda" description="Crie a primeira tarefa para ver o gráfico." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.tasksByStatus ?? []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                  <YAxis
                    type="category"
                    dataKey="status"
                    width={110}
                    tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
                  />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="total" name="Tarefas" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Próximos eventos</h3>
          {loading ? null : data && data.upcomingEvents.length === 0 ? (
            <EmptyState
              title="Nenhum evento futuro"
              description="Cadastre eventos para vê-los aqui."
              actionLabel="Criar evento"
              onAction={() => navigate('/eventos')}
            />
          ) : (
            <ul className="space-y-2">
              {data?.upcomingEvents.map((ev) => (
                <li key={ev.id}>
                  <button
                    onClick={() => navigate(`/eventos/${ev.id}`)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-[var(--color-surface-hover)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{ev.name}</span>
                      <span className="block text-xs text-[var(--color-text-muted)]">
                        {formatDate(ev.start_date)} · {ev.location ?? 'Local a definir'}
                      </span>
                    </span>
                    <Badge tone={eventStatusTones[ev.status]}>{eventStatusLabels[ev.status]}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Tarefas prioritárias</h3>
          {loading ? null : data && data.priorityTasks.length === 0 ? (
            <EmptyState title="Nada urgente" description="Nenhuma tarefa de alta prioridade em aberto." />
          ) : (
            <ul className="space-y-2">
              {data?.priorityTasks.map((task) => (
                <li key={task.id}>
                  <button
                    onClick={() => navigate(`/tarefas?task=${task.id}`)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-[var(--color-surface-hover)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{task.title}</span>
                      <span className="block text-xs text-[var(--color-text-muted)]">
                        Prazo: {formatDate(task.due_date)}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <Badge tone={priorityTones[task.priority]}>{taskPriorityLabels[task.priority]}</Badge>
                      <Badge tone={taskStatusTones[task.status]}>{taskStatusLabels[task.status]}</Badge>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Atividades recentes</h3>
          {loading ? null : data && data.recentActivity.length === 0 ? (
            <EmptyState title="Sem atividades" description="As ações da equipe aparecerão aqui." />
          ) : (
            <ul className="space-y-2.5">
              {data?.recentActivity.map((log) => (
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
        </Card>
      </div>
    </div>
  );
}
