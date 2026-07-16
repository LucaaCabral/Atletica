import { useMemo, useState } from 'react';
import { Download, BarChart3 } from 'lucide-react';
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
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@/hooks/useQuery';
import type { TaskStatus, TransactionType } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { KpiCard } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState, ErrorState, FullPageSpinner } from '@/components/ui/State';
import { ChartCard, chartTooltipStyle } from '@/components/charts/ChartCard';
import { taskStatusLabels, marketingStatusLabels } from '@/utils/labels';
import { formatCurrency, todayISO } from '@/utils/format';
import { exportToCsv } from '@/utils/csv';

interface ReportData {
  finance: { month: string; receitas: number; despesas: number }[];
  financeByEvent: { name: string; receitas: number; despesas: number }[];
  tasksByStatus: { status: string; total: number }[];
  tasksByDepartment: { name: string; concluidas: number; abertas: number }[];
  completionRate: number | null;
  marketingByStatus: { status: string; total: number }[];
  attendanceBySport: { name: string; presenca: number }[];
  activeClubMembers: number;
  closedSponsors: number;
  totalIncome: number;
  totalExpense: number;
}

export function ReportsPage() {
  const { can } = useAuth();
  const canFinance = can('finance.view');

  const [tab, setTab] = useState(canFinance ? 'finance' : 'tasks');
  const [startDate, setStartDate] = useState(() => format(startOfMonth(subMonths(new Date(), 5)), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(todayISO());

  const report = useQuery<ReportData>(async () => {
    const [txs, tasks, departments, marketing, attendance, sports, club, sponsors, events] = await Promise.all([
      canFinance
        ? supabase
            .from('financial_transactions')
            .select('type, amount, date, status, event_id')
            .gte('date', startDate)
            .lte('date', endDate)
            .neq('status', 'cancelled')
        : Promise.resolve({ data: [] }),
      supabase
        .from('tasks')
        .select('status, sector_id, created_at')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`),
      supabase.from('sectors').select('id, name'),
      supabase
        .from('marketing_requests')
        .select('status, created_at')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`),
      supabase.from('training_attendance').select('status, training:trainings(sport_id, date)'),
      supabase.from('sports').select('id, name'),
      supabase.from('members_club').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('sponsors').select('id', { count: 'exact', head: true }).in('status', ['closed', 'renewal']),
      supabase.from('events').select('id, name'),
    ]);

    const txList = (txs.data ?? []) as { type: TransactionType; amount: number; date: string; event_id: string | null }[];
    const byMonth = new Map<string, { receitas: number; despesas: number }>();
    for (const t of txList) {
      const key = t.date.slice(0, 7);
      const bucket = byMonth.get(key) ?? { receitas: 0, despesas: 0 };
      if (t.type === 'income') bucket.receitas += Number(t.amount);
      else bucket.despesas += Number(t.amount);
      byMonth.set(key, bucket);
    }
    const finance = Array.from(byMonth.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, v]) => ({ month: key, ...v }));

    const eventNames = new Map(((events.data ?? []) as { id: string; name: string }[]).map((e) => [e.id, e.name]));
    const byEvent = new Map<string, { receitas: number; despesas: number }>();
    for (const t of txList) {
      if (!t.event_id) continue;
      const name = eventNames.get(t.event_id) ?? 'Evento';
      const bucket = byEvent.get(name) ?? { receitas: 0, despesas: 0 };
      if (t.type === 'income') bucket.receitas += Number(t.amount);
      else bucket.despesas += Number(t.amount);
      byEvent.set(name, bucket);
    }
    const financeByEvent = Array.from(byEvent.entries()).map(([name, v]) => ({ name, ...v }));

    const taskList = (tasks.data ?? []) as { status: TaskStatus; sector_id: string | null }[];
    const statusCount = new Map<string, number>();
    for (const t of taskList) {
      statusCount.set(t.status, (statusCount.get(t.status) ?? 0) + 1);
    }
    const tasksByStatus = Array.from(statusCount.entries()).map(([status, total]) => ({
      status: taskStatusLabels[status as TaskStatus] ?? status,
      total,
    }));

    const deptNames = new Map(((departments.data ?? []) as { id: string; name: string }[]).map((d) => [d.id, d.name]));
    const byDept = new Map<string, { concluidas: number; abertas: number }>();
    for (const t of taskList) {
      const name = t.sector_id ? (deptNames.get(t.sector_id) ?? 'Sem setor') : 'Sem setor';
      const bucket = byDept.get(name) ?? { concluidas: 0, abertas: 0 };
      if (t.status === 'done') bucket.concluidas += 1;
      else if (t.status !== 'cancelled') bucket.abertas += 1;
      byDept.set(name, bucket);
    }
    const tasksByDepartment = Array.from(byDept.entries()).map(([name, v]) => ({ name, ...v }));

    const finished = taskList.filter((t) => t.status !== 'cancelled');
    const completionRate =
      finished.length > 0 ? Math.round((finished.filter((t) => t.status === 'done').length / finished.length) * 100) : null;

    const mkCount = new Map<string, number>();
    for (const m of (marketing.data ?? []) as { status: string }[]) {
      mkCount.set(m.status, (mkCount.get(m.status) ?? 0) + 1);
    }
    const marketingByStatus = Array.from(mkCount.entries()).map(([status, total]) => ({
      status: marketingStatusLabels[status as keyof typeof marketingStatusLabels] ?? status,
      total,
    }));

    const sportNames = new Map(((sports.data ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));
    const bySport = new Map<string, { present: number; total: number }>();
    for (const row of (attendance.data ?? []) as unknown as { status: string; training: { sport_id: string; date: string } | null }[]) {
      if (!row.training) continue;
      const day = row.training.date.slice(0, 10);
      if (day < startDate || day > endDate) continue;
      const name = sportNames.get(row.training.sport_id) ?? 'Modalidade';
      const bucket = bySport.get(name) ?? { present: 0, total: 0 };
      bucket.total += 1;
      if (row.status === 'present') bucket.present += 1;
      bySport.set(name, bucket);
    }
    const attendanceBySport = Array.from(bySport.entries()).map(([name, v]) => ({
      name,
      presenca: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
    }));

    return {
      finance,
      financeByEvent,
      tasksByStatus,
      tasksByDepartment,
      completionRate,
      marketingByStatus,
      attendanceBySport,
      activeClubMembers: club.count ?? 0,
      closedSponsors: sponsors.count ?? 0,
      totalIncome: txList.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
      totalExpense: txList.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
    };
  }, [startDate, endDate, canFinance]);

  const tabs = useMemo(
    () => [
      ...(canFinance ? [{ id: 'finance', label: 'Financeiro' }] : []),
      { id: 'tasks', label: 'Tarefas' },
      { id: 'marketing', label: 'Marketing' },
      { id: 'sports', label: 'Esportes' },
      { id: 'general', label: 'Geral' },
    ],
    [canFinance],
  );

  const exportCurrent = () => {
    const data = report.data;
    if (!data) return;
    if (tab === 'finance') {
      exportToCsv(
        `relatorio-financeiro-${todayISO()}`,
        ['Mês', 'Receitas', 'Despesas'],
        data.finance.map((f) => [f.month, f.receitas.toFixed(2), f.despesas.toFixed(2)]),
      );
    } else if (tab === 'tasks') {
      exportToCsv(
        `relatorio-tarefas-${todayISO()}`,
        ['Setor', 'Concluídas', 'Em aberto'],
        data.tasksByDepartment.map((d) => [d.name, d.concluidas, d.abertas]),
      );
    } else if (tab === 'marketing') {
      exportToCsv(
        `relatorio-marketing-${todayISO()}`,
        ['Status', 'Total'],
        data.marketingByStatus.map((m) => [m.status, m.total]),
      );
    } else if (tab === 'sports') {
      exportToCsv(
        `relatorio-esportes-${todayISO()}`,
        ['Modalidade', 'Frequência (%)'],
        data.attendanceBySport.map((s) => [s.name, s.presenca]),
      );
    } else {
      exportToCsv(
        `relatorio-geral-${todayISO()}`,
        ['Indicador', 'Valor'],
        [
          ['Sócios ativos', data.activeClubMembers],
          ['Patrocinadores fechados', data.closedSponsors],
          ['Taxa de conclusão de tarefas (%)', data.completionRate ?? 0],
        ],
      );
    }
  };

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Indicadores consolidados por período. Exportação em CSV disponível."
        breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Relatórios' }]}
        actions={
          <Button variant="outline" icon={<Download size={16} />} onClick={exportCurrent}>
            Exportar CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Input
          label="De"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full sm:w-auto"
        />
        <Input
          label="Até"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-full sm:w-auto"
        />
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} className="mb-4" />

      {report.error ? (
        <ErrorState message={report.error} onRetry={() => void report.refetch()} />
      ) : report.loading ? (
        <FullPageSpinner />
      ) : !report.data ? null : tab === 'finance' && canFinance ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <KpiCard title="Receitas no período" value={formatCurrency(report.data.totalIncome)} tone="success" />
            <KpiCard title="Despesas no período" value={formatCurrency(report.data.totalExpense)} tone="danger" />
            <KpiCard
              title="Resultado"
              value={formatCurrency(report.data.totalIncome - report.data.totalExpense)}
              tone={report.data.totalIncome - report.data.totalExpense >= 0 ? 'success' : 'danger'}
            />
          </div>
          <ChartCard title="Receitas e despesas por mês">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.data.finance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} width={80} />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="receitas" name="Receitas" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="var(--color-danger)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <ChartCard title="Resultado por evento">
            {report.data.financeByEvent.length === 0 ? (
              <EmptyState title="Sem dados" description="Vincule movimentações a eventos para ver o resultado por evento." />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.data.financeByEvent} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="receitas" name="Receitas" fill="var(--color-success)" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="despesas" name="Despesas" fill="var(--color-danger)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </div>
      ) : tab === 'tasks' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <KpiCard
              title="Taxa de conclusão"
              value={report.data.completionRate !== null ? `${report.data.completionRate}%` : '—'}
              tone="info"
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Tarefas por status">
              <div className="h-64">
                {report.data.tasksByStatus.length === 0 ? (
                  <EmptyState title="Sem tarefas no período" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.data.tasksByStatus} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                      <YAxis type="category" dataKey="status" width={110} tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Bar dataKey="total" name="Tarefas" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </ChartCard>
            <ChartCard title="Tarefas por setor">
              <div className="h-64">
                {report.data.tasksByDepartment.length === 0 ? (
                  <EmptyState title="Sem tarefas no período" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.data.tasksByDepartment}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }} interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="concluidas" name="Concluídas" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="abertas" name="Em aberto" fill="var(--color-info)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </ChartCard>
          </div>
        </div>
      ) : tab === 'marketing' ? (
        <ChartCard title="Pedidos de marketing por status">
          <div className="h-72">
            {report.data.marketingByStatus.length === 0 ? (
              <EmptyState title="Sem pedidos no período" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.data.marketingByStatus} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                  <YAxis type="category" dataKey="status" width={170} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="total" name="Pedidos" fill="var(--color-secondary)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>
      ) : tab === 'sports' ? (
        <ChartCard title="Frequência média por modalidade (%)">
          <div className="h-72">
            {report.data.attendanceBySport.length === 0 ? (
              <EmptyState title="Sem chamadas no período" description="Registre presença nos treinos para gerar este relatório." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.data.attendanceBySport}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="presenca" name="Frequência" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KpiCard title="Sócios ativos" value={report.data.activeClubMembers} icon={<BarChart3 size={18} />} tone="success" />
          <KpiCard title="Patrocinadores fechados" value={report.data.closedSponsors} tone="info" />
          <KpiCard
            title="Conclusão de tarefas"
            value={report.data.completionRate !== null ? `${report.data.completionRate}%` : '—'}
          />
        </div>
      )}
    </div>
  );
}
