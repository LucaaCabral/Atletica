import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckSquare, Megaphone, Target, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@/hooks/useQuery';
import type { Task, MarketingRequest, FinancialTransaction, SectorGoal, Sector, TaskPriority } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge, priorityTones } from '@/components/ui/Badge';
import { EmptyState, ErrorState } from '@/components/ui/State';
import { formatDate, todayISO } from '@/utils/format';
import { taskPriorityLabels } from '@/utils/labels';

interface PendingItem {
  id: string;
  title: string;
  kind: 'Tarefa' | 'Marketing' | 'Financeiro' | 'Meta';
  sectorName: string;
  priority: TaskPriority;
  detail: string;
  link: string;
}

const PRIORITY_WEIGHT: Record<TaskPriority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

export function PendingItemsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const canFinance = can('finance.view');
  const today = todayISO();

  const data = useQuery<PendingItem[]>(async () => {
    const [sectorsRes, tasksRes, marketingRes, txRes, goalsRes] = await Promise.all([
      supabase.from('sectors').select('id, name'),
      supabase
        .from('tasks')
        .select('*')
        .eq('is_archived', false)
        .lt('due_date', today)
        .not('status', 'in', '(done,cancelled)'),
      supabase
        .from('marketing_requests')
        .select('*, sector:sectors(id, name)')
        .in('status', ['awaiting_approval', 'changes_requested']),
      canFinance
        ? supabase
            .from('financial_transactions')
            .select('*, sector:sectors(id, name)')
            .eq('status', 'pending')
            .lt('due_date', today)
        : Promise.resolve({ data: [] }),
      supabase.from('sector_goals').select('*, sector:sectors(id, name)').neq('status', 'achieved'),
    ]);

    const sectorNames = new Map(((sectorsRes.data ?? []) as Pick<Sector, 'id' | 'name'>[]).map((s) => [s.id, s.name]));

    const items: PendingItem[] = [];

    for (const t of (tasksRes.data ?? []) as Task[]) {
      items.push({
        id: `task-${t.id}`,
        title: t.title,
        kind: 'Tarefa',
        sectorName: t.sector_id ? sectorNames.get(t.sector_id) ?? 'Sem setor' : 'Sem setor',
        priority: t.priority,
        detail: `Atrasada desde ${formatDate(t.due_date)}`,
        link: `/tarefas?task=${t.id}`,
      });
    }

    for (const m of (marketingRes.data ?? []) as MarketingRequest[]) {
      items.push({
        id: `mkt-${m.id}`,
        title: m.title,
        kind: 'Marketing',
        sectorName: m.sector?.name ?? 'Marketing',
        priority: m.priority,
        detail: m.status === 'awaiting_approval' ? 'Aguardando aprovação' : 'Ajustes solicitados',
        link: '/marketing',
      });
    }

    for (const tx of (txRes.data ?? []) as FinancialTransaction[]) {
      items.push({
        id: `fin-${tx.id}`,
        title: tx.description,
        kind: 'Financeiro',
        sectorName: tx.sector?.name ?? 'Tesouraria',
        priority: 'high',
        detail: `Vencida desde ${formatDate(tx.due_date)}`,
        link: '/financeiro',
      });
    }

    for (const g of (goalsRes.data ?? []) as SectorGoal[]) {
      if (g.status !== 'missed' && !(g.due_date && g.due_date < today)) continue;
      items.push({
        id: `goal-${g.id}`,
        title: g.title,
        kind: 'Meta',
        sectorName: g.sector?.name ?? 'Setor',
        priority: 'medium',
        detail: g.status === 'missed' ? 'Meta não atingida' : 'Prazo da meta vencido',
        link: `/setores/${g.sector_id}?aba=metas`,
      });
    }

    return items.sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);
  }, [canFinance, today]);

  const grouped = useMemo(() => {
    const map = new Map<string, PendingItem[]>();
    for (const item of data.data ?? []) {
      map.set(item.sectorName, [...(map.get(item.sectorName) ?? []), item]);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [data.data]);

  const kindIcon: Record<PendingItem['kind'], typeof CheckSquare> = {
    Tarefa: CheckSquare,
    Marketing: Megaphone,
    Financeiro: Wallet,
    Meta: Target,
  };

  if (data.error) return <ErrorState message={data.error} onRetry={() => void data.refetch()} />;

  return (
    <div>
      <PageHeader
        title="Central de Pendências"
        description="Tudo que precisa de atenção agora, agrupado por setor e ordenado por prioridade."
        breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Central de Pendências' }]}
      />

      {!data.loading && (data.data ?? []).length === 0 ? (
        <EmptyState icon={<AlertTriangle size={24} />} title="Tudo em dia" description="Nenhuma pendência no momento." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {grouped.map(([sectorName, items]) => (
            <Card key={sectorName} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{sectorName}</h3>
                <Badge tone="danger">{items.length}</Badge>
              </div>
              <ul className="space-y-1.5">
                {items.map((item) => {
                  const Icon = kindIcon[item.kind];
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => navigate(item.link)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-[var(--color-surface-hover)]"
                      >
                        <span className="shrink-0 rounded-lg bg-[var(--color-surface-secondary)] p-1.5 text-[var(--color-text-secondary)]">
                          <Icon size={14} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.title}</span>
                          <span className="block text-xs text-[var(--color-text-muted)]">{item.detail}</span>
                        </span>
                        <Badge tone={priorityTones[item.priority]}>{taskPriorityLabels[item.priority]}</Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
