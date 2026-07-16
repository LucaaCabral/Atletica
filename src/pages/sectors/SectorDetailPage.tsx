import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Plus,
  Trash2,
  Wallet,
  CheckSquare,
  Target,
  PartyPopper,
  FolderOpen,
  Trophy,
  Megaphone,
  Handshake,
  BadgeCheck,
  Settings as SettingsIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useQuery } from '@/hooks/useQuery';
import { logActivity } from '@/services/activityLog';
import type {
  Event,
  FinancialTransaction,
  Profile,
  Sector,
  SectorGoal,
  SectorMember,
  SectorTab,
  Task,
  TaskStatus,
} from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, KpiCard, ProgressBar } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Tabs } from '@/components/ui/Tabs';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, FullPageSpinner } from '@/components/ui/State';
import { TaskBoard } from '@/pages/tasks/TaskBoard';
import { TaskModal } from '@/pages/tasks/TaskModal';
import { generateNextOccurrence } from '@/services/recurrence';
import { formatCurrency, formatDate } from '@/utils/format';
import { sectorGoalStatusLabels, sectorTypeLabels } from '@/utils/labels';
import { eventStatusTones } from '@/components/ui/Badge';
import { eventStatusLabels } from '@/utils/labels';

const TAB_META: Record<SectorTab, { label: string }> = {
  dashboard: { label: 'Dashboard' },
  kanban: { label: 'Kanban' },
  calendario: { label: 'Calendário' },
  equipe: { label: 'Equipe' },
  metas: { label: 'Metas' },
  eventos: { label: 'Eventos' },
  financeiro: { label: 'Financeiro' },
  modulo: { label: 'Módulo' },
  documentos: { label: 'Documentos' },
  configuracoes: { label: 'Configurações' },
};

const MODULE_ROUTES: Partial<Record<Sector['sector_type'], { path: string; label: string; icon: typeof Trophy; description: string }>> = {
  esportes: {
    path: '/esportes',
    label: 'Esportes',
    icon: Trophy,
    description: 'Modalidades, atletas, times, treinos e jogos.',
  },
  marketing: {
    path: '/marketing',
    label: 'Marketing',
    icon: Megaphone,
    description: 'Pedidos de arte, aprovações e calendário de publicações.',
  },
  patrocinio: {
    path: '/patrocinadores',
    label: 'Patrocínio',
    icon: Handshake,
    description: 'Pipeline de patrocinadores e parcerias.',
  },
  socios: {
    path: '/socios',
    label: 'Sócios',
    icon: BadgeCheck,
    description: 'Carteirinhas, pagamentos e benefícios do plano de sócios.',
  },
};

const OPEN_TASK_STATUSES: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'in_review'];

export function SectorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { profile, can } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<SectorTab>((params.get('aba') as SectorTab) ?? 'dashboard');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [goalModal, setGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SectorGoal | null>(null);
  const [goalForm, setGoalForm] = useState({
    title: '',
    description: '',
    target_value: '',
    current_value: '0',
    unit: '',
    due_date: '',
    status: 'in_progress' as SectorGoal['status'],
  });
  const [memberModal, setMemberModal] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'diretor' | 'assessor'>('assessor');
  const [settingsForm, setSettingsForm] = useState<{
    name: string;
    description: string;
    sector_type: Sector['sector_type'];
  } | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const sector = useQuery<Sector | null>(async () => {
    if (!id) return null;
    const { data, error } = await supabase.from('sectors').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const s = data as Sector;
    setSettingsForm({ name: s.name, description: s.description ?? '', sector_type: s.sector_type });
    return s;
  }, [id]);

  const members = useQuery<SectorMember[]>(async () => {
    if (!id) return [];
    const { data } = await supabase
      .from('sector_members')
      .select('*, profile:profiles(id, full_name, avatar_url, role)')
      .eq('sector_id', id);
    return (data ?? []) as SectorMember[];
  }, [id]);

  const allProfiles = useQuery<Profile[]>(async () => {
    const { data } = await supabase.from('profiles').select('id, full_name, avatar_url, role').order('full_name');
    return (data ?? []) as Profile[];
  });

  const tasks = useQuery<Task[]>(async () => {
    if (!id) return [];
    const { data } = await supabase
      .from('tasks')
      .select(
        '*, sector:sectors(*), event:events(id, name), assignees:task_assignees(task_id, profile_id, created_at, profile:profiles(id, full_name, avatar_url))',
      )
      .eq('sector_id', id)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });
    return (data ?? []) as Task[];
  }, [id]);

  const events = useQuery<Event[]>(async () => {
    if (!id) return [];
    const { data } = await supabase.from('events').select('*').eq('sector_id', id).order('start_date', { ascending: false });
    return (data ?? []) as Event[];
  }, [id]);

  const canFinance = can('finance.view');
  const transactions = useQuery<FinancialTransaction[]>(async () => {
    if (!id || !canFinance) return [];
    const { data } = await supabase
      .from('financial_transactions')
      .select('*, category:financial_categories(*)')
      .eq('sector_id', id)
      .order('date', { ascending: false })
      .limit(50);
    return (data ?? []) as FinancialTransaction[];
  }, [id, canFinance]);

  const goals = useQuery<SectorGoal[]>(async () => {
    if (!id) return [];
    const { data } = await supabase.from('sector_goals').select('*').eq('sector_id', id).order('due_date');
    return (data ?? []) as SectorGoal[];
  }, [id]);

  const isTop = profile ? ['presidente', 'vice'].includes(profile.role) : false;
  const isDirector = useMemo(
    () => isTop || (members.data ?? []).some((m) => m.profile_id === profile?.id && m.role_in_sector === 'diretor'),
    [members.data, profile?.id, isTop],
  );

  const openTaskCount = (tasks.data ?? []).filter((t) => OPEN_TASK_STATUSES.includes(t.status)).length;
  const doneTaskCount = (tasks.data ?? []).filter((t) => t.status === 'done').length;
  const overdueTaskCount = (tasks.data ?? []).filter(
    (t) => t.due_date && t.due_date < new Date().toISOString().slice(0, 10) && OPEN_TASK_STATUSES.includes(t.status),
  ).length;

  const moveTask = async (taskId: string, status: TaskStatus) => {
    const task = (tasks.data ?? []).find((t) => t.id === taskId);
    const { error } = await supabase
      .from('tasks')
      .update({ status, completed_at: status === 'done' ? new Date().toISOString() : null })
      .eq('id', taskId);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (status === 'done' && task?.recurrence_type) {
      void generateNextOccurrence(task);
    }
    void tasks.refetch();
  };

  const saveGoal = async () => {
    if (!id || !goalForm.title.trim()) return;
    const payload = {
      sector_id: id,
      title: goalForm.title.trim(),
      description: goalForm.description.trim() || null,
      target_value: goalForm.target_value ? Number(goalForm.target_value) : null,
      current_value: Number(goalForm.current_value) || 0,
      unit: goalForm.unit.trim() || null,
      due_date: goalForm.due_date || null,
      status: goalForm.status,
    };
    const result = editingGoal
      ? await supabase.from('sector_goals').update(payload).eq('id', editingGoal.id)
      : await supabase.from('sector_goals').insert(payload);
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    toast.success('Meta salva.');
    setGoalModal(false);
    void goals.refetch();
  };

  const removeGoal = async (goalId: string) => {
    await supabase.from('sector_goals').delete().eq('id', goalId);
    void goals.refetch();
  };

  const addMember = async () => {
    if (!id || !newMemberId) return;
    const { error } = await supabase
      .from('sector_members')
      .insert({ sector_id: id, profile_id: newMemberId, role_in_sector: newMemberRole });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Membro adicionado ao setor.');
    setMemberModal(false);
    setNewMemberId('');
    void members.refetch();
  };

  const removeMember = async (profileId: string) => {
    if (!id) return;
    await supabase.from('sector_members').delete().eq('sector_id', id).eq('profile_id', profileId);
    void members.refetch();
  };

  const saveSettings = async () => {
    if (!id || !settingsForm) return;
    setSavingSettings(true);
    const { error } = await supabase
      .from('sectors')
      .update({
        name: settingsForm.name.trim(),
        description: settingsForm.description.trim() || null,
        sector_type: settingsForm.sector_type,
      })
      .eq('id', id);
    setSavingSettings(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    void logActivity({ action: 'update', module: 'setores', entityType: 'sector', entityId: id, summary: 'Atualizou configurações do setor' });
    toast.success('Setor atualizado.');
    void sector.refetch();
  };

  const moveTabOrder = async (tabId: SectorTab, direction: -1 | 1) => {
    if (!id || !sector.data) return;
    const order = [...sector.data.tabs_order];
    const idx = order.indexOf(tabId);
    const swapWith = idx + direction;
    if (idx < 0 || swapWith < 0 || swapWith >= order.length) return;
    [order[idx], order[swapWith]] = [order[swapWith], order[idx]];
    const { error } = await supabase.from('sectors').update({ tabs_order: order }).eq('id', id);
    if (!error) void sector.refetch();
  };

  if (sector.loading) return <FullPageSpinner />;
  if (sector.error || !sector.data) {
    return <ErrorState message={sector.error ?? 'Setor não encontrado.'} onRetry={() => navigate('/setores')} />;
  }

  const s = sector.data;
  const moduleInfo = MODULE_ROUTES[s.sector_type];
  const tabItems = s.tabs_order
    .filter((t) => TAB_META[t] && (t !== 'modulo' || moduleInfo))
    .map((t) => ({ id: t, label: t === 'modulo' ? moduleInfo!.label : TAB_META[t].label }));

  return (
    <div>
      <PageHeader
        title={s.name}
        description={s.description ?? sectorTypeLabels[s.sector_type]}
        breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Setores', to: '/setores' }, { label: s.name }]}
        actions={<Badge tone="primary">{sectorTypeLabels[s.sector_type]}</Badge>}
      />

      <Tabs tabs={tabItems} active={tab} onChange={(v) => setTab(v as SectorTab)} variant="pill" className="mb-4" />

      <div key={tab} className="animate-fade-in">
      {tab === 'dashboard' && (
        <div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard title="Tarefas em aberto" value={openTaskCount} icon={<CheckSquare size={18} />} loading={tasks.loading} onClick={() => setTab('kanban')} />
            <KpiCard title="Tarefas concluídas" value={doneTaskCount} icon={<CheckSquare size={18} />} tone="success" loading={tasks.loading} />
            <KpiCard title="Tarefas atrasadas" value={overdueTaskCount} icon={<CheckSquare size={18} />} tone={overdueTaskCount > 0 ? 'danger' : 'default'} loading={tasks.loading} />
            <KpiCard title="Membros do setor" value={members.data?.length ?? 0} icon={<CheckSquare size={18} />} loading={members.loading} onClick={() => setTab('equipe')} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold">Metas</h3>
              {(goals.data ?? []).length === 0 ? (
                <EmptyState title="Nenhuma meta cadastrada" description="Defina metas para acompanhar o progresso do setor." />
              ) : (
                <ul className="space-y-3">
                  {(goals.data ?? []).slice(0, 4).map((g) => (
                    <li key={g.id}>
                      <p className="text-sm font-medium">{g.title}</p>
                      <ProgressBar value={g.current_value} max={g.target_value ?? 100} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold">Próximos eventos</h3>
              {(events.data ?? []).length === 0 ? (
                <EmptyState title="Nenhum evento" description="Eventos deste setor aparecerão aqui." />
              ) : (
                <ul className="space-y-2">
                  {(events.data ?? []).slice(0, 4).map((ev) => (
                    <li key={ev.id}>
                      <button
                        onClick={() => navigate(`/eventos/${ev.id}`)}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[var(--color-surface-hover)]"
                      >
                        <span>{ev.name}</span>
                        <Badge tone={eventStatusTones[ev.status]}>{eventStatusLabels[ev.status]}</Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === 'kanban' && (
        <div>
          <div className="mb-3 flex justify-end">
            <Button
              size="sm"
              icon={<Plus size={15} />}
              onClick={() => {
                setActiveTask(null);
                setTaskModalOpen(true);
              }}
            >
              Nova tarefa
            </Button>
          </div>
          <TaskBoard
            tasks={tasks.data ?? []}
            onMoveTask={(taskId, status) => void moveTask(taskId, status)}
            onOpenTask={(t) => {
              setActiveTask(t);
              setTaskModalOpen(true);
            }}
            canManage={can('tasks.manage')}
          />
        </div>
      )}

      {tab === 'calendario' && (
        <Card className="p-4">
          {(tasks.data ?? []).filter((t) => t.due_date).length === 0 && (events.data ?? []).length === 0 ? (
            <EmptyState title="Nada agendado" description="Tarefas com prazo e eventos deste setor aparecerão aqui." />
          ) : (
            <ul className="space-y-2">
              {[...(tasks.data ?? []).filter((t) => t.due_date).map((t) => ({ id: t.id, title: t.title, date: t.due_date!, kind: 'Tarefa' })),
                ...(events.data ?? []).filter((e) => e.start_date).map((e) => ({ id: e.id, title: e.name, date: e.start_date!, kind: 'Evento' }))]
                .sort((a, b) => (a.date < b.date ? -1 : 1))
                .map((item) => (
                  <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--color-surface-hover)]">
                    <span>{item.title}</span>
                    <span className="flex items-center gap-2 text-[var(--color-text-muted)]">
                      <Badge tone="neutral">{item.kind}</Badge>
                      {formatDate(item.date)}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'equipe' && (
        <div>
          {isDirector && (
            <div className="mb-3 flex justify-end">
              <Button size="sm" icon={<Plus size={15} />} onClick={() => setMemberModal(true)}>
                Adicionar membro
              </Button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(members.data ?? []).map((m) => (
              <Card key={m.profile_id} className="flex items-center gap-3 p-3">
                <Avatar name={m.profile?.full_name ?? '?'} src={m.profile?.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.profile?.full_name}</p>
                  <Badge tone={m.role_in_sector === 'diretor' ? 'primary' : 'neutral'}>
                    {m.role_in_sector === 'diretor' ? 'Diretor' : 'Assessor'}
                  </Badge>
                </div>
                {isDirector && (
                  <IconButton label="Remover do setor" size="sm" onClick={() => void removeMember(m.profile_id)}>
                    <Trash2 size={14} />
                  </IconButton>
                )}
              </Card>
            ))}
            {(members.data ?? []).length === 0 && (
              <EmptyState title="Nenhum membro neste setor" description="Adicione diretores e assessores." />
            )}
          </div>
        </div>
      )}

      {tab === 'metas' && (
        <div>
          <div className="mb-3 flex justify-end">
            <Button
              size="sm"
              icon={<Plus size={15} />}
              onClick={() => {
                setEditingGoal(null);
                setGoalForm({ title: '', description: '', target_value: '', current_value: '0', unit: '', due_date: '', status: 'in_progress' });
                setGoalModal(true);
              }}
            >
              Nova meta
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(goals.data ?? []).map((g) => (
              <Card key={g.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{g.title}</p>
                    {g.description && <p className="text-xs text-[var(--color-text-secondary)]">{g.description}</p>}
                  </div>
                  <Badge tone={g.status === 'achieved' ? 'success' : g.status === 'missed' ? 'danger' : 'info'}>
                    {sectorGoalStatusLabels[g.status]}
                  </Badge>
                </div>
                <ProgressBar
                  className="mt-2"
                  value={g.current_value}
                  max={g.target_value ?? 100}
                  label={g.unit ? `${g.current_value}/${g.target_value ?? '—'} ${g.unit}` : undefined}
                />
                {g.due_date && <p className="mt-1 text-xs text-[var(--color-text-muted)]">Prazo: {formatDate(g.due_date)}</p>}
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingGoal(g);
                      setGoalForm({
                        title: g.title,
                        description: g.description ?? '',
                        target_value: g.target_value?.toString() ?? '',
                        current_value: g.current_value.toString(),
                        unit: g.unit ?? '',
                        due_date: g.due_date ?? '',
                        status: g.status,
                      });
                      setGoalModal(true);
                    }}
                  >
                    Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void removeGoal(g.id)}>
                    Excluir
                  </Button>
                </div>
              </Card>
            ))}
            {(goals.data ?? []).length === 0 && (
              <EmptyState icon={<Target size={22} />} title="Nenhuma meta" description="Crie metas para acompanhar o progresso do setor." />
            )}
          </div>
        </div>
      )}

      {tab === 'eventos' && (
        <div>
          <div className="mb-3 flex justify-end">
            <Button size="sm" icon={<Plus size={15} />} onClick={() => navigate('/eventos')}>
              Ver todos os eventos
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(events.data ?? []).map((ev) => (
              <button key={ev.id} onClick={() => navigate(`/eventos/${ev.id}`)} className="text-left">
                <Card className="p-4 transition-colors hover:border-[var(--color-primary)]">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{ev.name}</p>
                    <Badge tone={eventStatusTones[ev.status]}>{eventStatusLabels[ev.status]}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">{formatDate(ev.start_date)}</p>
                </Card>
              </button>
            ))}
            {(events.data ?? []).length === 0 && (
              <EmptyState icon={<PartyPopper size={22} />} title="Nenhum evento" description="Eventos deste setor aparecerão aqui." />
            )}
          </div>
        </div>
      )}

      {tab === 'financeiro' && (
        <div>
          {!canFinance ? (
            <EmptyState icon={<Wallet size={22} />} title="Sem acesso" description="Você não tem permissão para ver o financeiro." />
          ) : (
            <Card className="overflow-hidden">
              {(transactions.data ?? []).length === 0 ? (
                <div className="p-6">
                  <EmptyState title="Nenhuma movimentação" description="Lançamentos financeiros deste setor aparecerão aqui." />
                </div>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]">
                  {(transactions.data ?? []).map((t) => (
                    <li key={t.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span>{t.description}</span>
                      <span className={t.type === 'income' ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>
                        {t.type === 'income' ? '+' : '-'}
                        {formatCurrency(t.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      )}

      {tab === 'modulo' && moduleInfo && (
        <Card className="flex flex-col items-start gap-3 p-6">
          <span className="rounded-xl bg-[var(--color-primary-soft)] p-3 text-[var(--color-primary)]">
            <moduleInfo.icon size={22} aria-hidden />
          </span>
          <div>
            <h3 className="font-semibold">Módulo de {moduleInfo.label}</h3>
            <p className="mt-1 max-w-md text-sm text-[var(--color-text-secondary)]">{moduleInfo.description}</p>
          </div>
          <Button icon={<ArrowRight size={16} />} onClick={() => navigate(moduleInfo.path)}>
            Abrir módulo de {moduleInfo.label}
          </Button>
        </Card>
      )}

      {tab === 'documentos' && (
        <EmptyState
          icon={<FolderOpen size={22} />}
          title="Documentos do setor"
          description="Envie e organize documentos em Documentos, vinculando-os a este setor."
        />
      )}

      {tab === 'configuracoes' && (
        <div className="grid max-w-2xl gap-4">
          {!isDirector ? (
            <EmptyState icon={<SettingsIcon size={22} />} title="Somente diretores" description="Apenas diretor(es) deste setor, presidente ou vice podem editar." />
          ) : (
            <>
              <Card className="p-5">
                <h3 className="mb-3 text-sm font-semibold">Dados do setor</h3>
                <div className="grid gap-3">
                  <Input
                    label="Nome"
                    value={settingsForm?.name ?? ''}
                    onChange={(e) => setSettingsForm((f) => (f ? { ...f, name: e.target.value } : f))}
                  />
                  <Textarea
                    label="Descrição"
                    value={settingsForm?.description ?? ''}
                    onChange={(e) => setSettingsForm((f) => (f ? { ...f, description: e.target.value } : f))}
                  />
                  <Select
                    label="Tipo de setor"
                    value={settingsForm?.sector_type ?? 'generic'}
                    options={Object.entries(sectorTypeLabels).map(([value, label]) => ({ value, label }))}
                    onChange={(e) =>
                      setSettingsForm((f) => (f ? { ...f, sector_type: e.target.value as Sector['sector_type'] } : f))
                    }
                  />
                  <div className="flex justify-end">
                    <Button loading={savingSettings} onClick={() => void saveSettings()}>
                      Salvar
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="mb-1 text-sm font-semibold">Ordem das abas</h3>
                <p className="mb-3 text-sm text-[var(--color-text-secondary)]">Personalize a ordem em que as abas aparecem para este setor.</p>
                <ul className="space-y-1.5">
                  {s.tabs_order.map((t, i) => (
                    <li key={t} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
                      {TAB_META[t]?.label ?? t}
                      <div className="flex gap-1">
                        <IconButton label="Mover para cima" size="sm" disabled={i === 0} onClick={() => void moveTabOrder(t, -1)}>
                          <ArrowUp size={14} />
                        </IconButton>
                        <IconButton label="Mover para baixo" size="sm" disabled={i === s.tabs_order.length - 1} onClick={() => void moveTabOrder(t, 1)}>
                          <ArrowDown size={14} />
                        </IconButton>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}
        </div>
      )}
      </div>

      <TaskModal
        open={taskModalOpen}
        task={activeTask}
        defaultSectorId={id}
        profiles={allProfiles.data ?? []}
        departments={[s]}
        events={(events.data ?? []).map((e) => ({ id: e.id, name: e.name }))}
        onClose={() => setTaskModalOpen(false)}
        onSaved={() => void tasks.refetch()}
      />

      <Modal
        open={goalModal}
        onClose={() => setGoalModal(false)}
        title={editingGoal ? 'Editar meta' : 'Nova meta'}
        footer={
          <>
            <Button variant="outline" onClick={() => setGoalModal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void saveGoal()}>Salvar</Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Input label="Título" required value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} />
          <Textarea label="Descrição" value={goalForm.description} onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Valor atual" type="number" value={goalForm.current_value} onChange={(e) => setGoalForm({ ...goalForm, current_value: e.target.value })} />
            <Input label="Meta (alvo)" type="number" value={goalForm.target_value} onChange={(e) => setGoalForm({ ...goalForm, target_value: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Unidade" placeholder="R$, %, un." value={goalForm.unit} onChange={(e) => setGoalForm({ ...goalForm, unit: e.target.value })} />
            <Input label="Prazo" type="date" value={goalForm.due_date} onChange={(e) => setGoalForm({ ...goalForm, due_date: e.target.value })} />
          </div>
          <Select
            label="Status"
            value={goalForm.status}
            options={Object.entries(sectorGoalStatusLabels).map(([value, label]) => ({ value, label }))}
            onChange={(e) => setGoalForm({ ...goalForm, status: e.target.value as SectorGoal['status'] })}
          />
        </div>
      </Modal>

      <Modal
        open={memberModal}
        onClose={() => setMemberModal(false)}
        title="Adicionar membro ao setor"
        footer={
          <>
            <Button variant="outline" onClick={() => setMemberModal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void addMember()}>Adicionar</Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Select
            label="Membro"
            value={newMemberId}
            placeholder="Selecione…"
            options={(allProfiles.data ?? [])
              .filter((p) => !(members.data ?? []).some((m) => m.profile_id === p.id))
              .map((p) => ({ value: p.id, label: p.full_name }))}
            onChange={(e) => setNewMemberId(e.target.value)}
          />
          <Select
            label="Papel no setor"
            value={newMemberRole}
            options={[
              { value: 'assessor', label: 'Assessor' },
              { value: 'diretor', label: 'Diretor' },
            ]}
            onChange={(e) => setNewMemberRole(e.target.value as 'diretor' | 'assessor')}
          />
        </div>
      </Modal>
    </div>
  );
}
