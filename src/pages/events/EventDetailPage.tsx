import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, MapPin, Pencil, Plus, Trash2, Upload, Users, CheckCircle2, Circle, Download, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useQuery } from '@/hooks/useQuery';
import { logActivity } from '@/services/activityLog';
import { uploadFile, deleteFile, downloadFile } from '@/services/storage';
import type {
  Sector,
  DocumentItem,
  Event,
  EventMember,
  EventStatus,
  EventTimelineItem,
  FinancialTransaction,
  Profile,
  Task,
} from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Card, KpiCard, ProgressBar } from '@/components/ui/Card';
import { Badge, eventStatusTones, taskStatusTones, transactionStatusTones } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState, ErrorState, FullPageSpinner } from '@/components/ui/State';
import { TaskModal } from '@/pages/tasks/TaskModal';
import { eventStatusLabels, taskStatusLabels, transactionStatusLabels } from '@/utils/labels';
import { formatCurrency, formatDate, formatFileSize } from '@/utils/format';

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, can } = useAuth();
  const { eventCategories } = useSettings();
  const toast = useToast();
  const canManage = can('events.manage');
  const canFinance = can('finance.view');

  const [tab, setTab] = useState('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newMilestone, setNewMilestone] = useState({ title: '', date: '' });
  const [newTeamMember, setNewTeamMember] = useState({ profile_id: '', role: '' });
  const [uploading, setUploading] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    category: '',
    status: 'planning' as EventStatus,
    start_date: '',
    end_date: '',
    location: '',
    address: '',
    expected_attendance: '',
    actual_attendance: '',
    budget: '',
    responsible_id: '',
    notes: '',
  });

  const event = useQuery<Event | null>(async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*, responsible:profiles(id, full_name, avatar_url)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as Event | null;
  }, [id]);

  const tasks = useQuery<Task[]>(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*, assignees:task_assignees(task_id, profile_id, created_at, profile:profiles(id, full_name, avatar_url))')
      .eq('event_id', id)
      .eq('is_archived', false)
      .order('due_date', { ascending: true, nullsFirst: false });
    return (data ?? []) as Task[];
  }, [id]);

  const timeline = useQuery<EventTimelineItem[]>(async () => {
    const { data } = await supabase.from('event_timeline').select('*').eq('event_id', id).order('date');
    return (data ?? []) as EventTimelineItem[];
  }, [id]);

  const team = useQuery<EventMember[]>(async () => {
    const { data } = await supabase
      .from('event_members')
      .select('*, profile:profiles(id, full_name, avatar_url, role)')
      .eq('event_id', id);
    return (data ?? []) as EventMember[];
  }, [id]);

  const transactions = useQuery<FinancialTransaction[]>(async () => {
    if (!canFinance) return [];
    const { data } = await supabase
      .from('financial_transactions')
      .select('*, category:financial_categories(*)')
      .eq('event_id', id)
      .order('date', { ascending: false });
    return (data ?? []) as FinancialTransaction[];
  }, [id, canFinance]);

  const documents = useQuery<DocumentItem[]>(async () => {
    const { data } = await supabase
      .from('documents')
      .select('*, uploader:profiles(id, full_name)')
      .eq('related_type', 'event')
      .eq('related_id', id)
      .order('created_at', { ascending: false });
    return (data ?? []) as DocumentItem[];
  }, [id]);

  const profiles = useQuery<Profile[]>(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('is_active', true).order('full_name');
    return (data ?? []) as Profile[];
  });

  const departments = useQuery<Sector[]>(async () => {
    const { data } = await supabase.from('sectors').select('*').eq('is_active', true).order('name');
    return (data ?? []) as Sector[];
  });

  const stats = useMemo(() => {
    const all = tasks.data ?? [];
    const done = all.filter((t) => t.status === 'done').length;
    const today = new Date().toISOString().slice(0, 10);
    const overdue = all.filter(
      (t) => t.due_date && t.due_date < today && !['done', 'cancelled'].includes(t.status),
    ).length;
    const spent = (transactions.data ?? [])
      .filter((t) => t.type === 'expense' && t.status !== 'cancelled')
      .reduce((s, t) => s + Number(t.amount), 0);
    const income = (transactions.data ?? [])
      .filter((t) => t.type === 'income' && t.status !== 'cancelled')
      .reduce((s, t) => s + Number(t.amount), 0);
    return { total: all.length, done, overdue, spent, income };
  }, [tasks.data, transactions.data]);

  if (event.loading) return <FullPageSpinner />;
  if (event.error) return <ErrorState message={event.error} onRetry={() => void event.refetch()} />;
  if (!event.data) return <ErrorState message="Evento não encontrado." onRetry={() => navigate('/eventos')} />;

  const ev = event.data;

  const openEdit = () => {
    setEditForm({
      name: ev.name,
      description: ev.description ?? '',
      category: ev.category ?? '',
      status: ev.status,
      start_date: ev.start_date ?? '',
      end_date: ev.end_date ?? '',
      location: ev.location ?? '',
      address: ev.address ?? '',
      expected_attendance: ev.expected_attendance?.toString() ?? '',
      actual_attendance: ev.actual_attendance?.toString() ?? '',
      budget: ev.budget?.toString() ?? '',
      responsible_id: ev.responsible_id ?? '',
      notes: ev.notes ?? '',
    });
    setEditOpen(true);
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const { error } = await supabase
      .from('events')
      .update({
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        category: editForm.category || null,
        status: editForm.status,
        start_date: editForm.start_date || null,
        end_date: editForm.end_date || null,
        location: editForm.location.trim() || null,
        address: editForm.address.trim() || null,
        expected_attendance: editForm.expected_attendance ? Number(editForm.expected_attendance) : null,
        actual_attendance: editForm.actual_attendance ? Number(editForm.actual_attendance) : null,
        budget: editForm.budget ? Number(editForm.budget) : null,
        responsible_id: editForm.responsible_id || null,
        notes: editForm.notes.trim() || null,
      })
      .eq('id', ev.id);
    setSaving(false);
    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }
    toast.success('Evento atualizado.');
    setEditOpen(false);
    void event.refetch();
  };

  const deleteEvent = async () => {
    const { error } = await supabase.from('events').delete().eq('id', ev.id);
    if (error) {
      toast.error(`Erro ao excluir: ${error.message}`);
      return;
    }
    toast.success('Evento excluído.');
    void logActivity({
      action: 'delete',
      module: 'eventos',
      entityType: 'event',
      entityId: ev.id,
      summary: `Excluiu o evento ${ev.name}`,
    });
    navigate('/eventos');
  };

  const addMilestone = async () => {
    if (!newMilestone.title.trim() || !newMilestone.date) {
      toast.error('Informe título e data do marco.');
      return;
    }
    const { error } = await supabase.from('event_timeline').insert({
      event_id: ev.id,
      title: newMilestone.title.trim(),
      date: newMilestone.date,
    });
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    setNewMilestone({ title: '', date: '' });
    void timeline.refetch();
  };

  const toggleMilestone = async (item: EventTimelineItem) => {
    await supabase.from('event_timeline').update({ is_done: !item.is_done }).eq('id', item.id);
    void timeline.refetch();
  };

  const removeMilestone = async (item: EventTimelineItem) => {
    await supabase.from('event_timeline').delete().eq('id', item.id);
    void timeline.refetch();
  };

  const addTeamMember = async () => {
    if (!newTeamMember.profile_id) {
      toast.error('Selecione um usuário.');
      return;
    }
    const { error } = await supabase.from('event_members').insert({
      event_id: ev.id,
      profile_id: newTeamMember.profile_id,
      role_in_event: newTeamMember.role.trim() || null,
    });
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Este usuário já está na equipe.' : error.message);
      return;
    }
    setNewTeamMember({ profile_id: '', role: '' });
    void team.refetch();
  };

  const removeTeamMember = async (memberId: string) => {
    await supabase.from('event_members').delete().eq('event_id', ev.id).eq('profile_id', memberId);
    void team.refetch();
  };

  const onUploadDocument = async (file: File) => {
    if (uploading) return;
    setUploading(true);
    const { path, error } = await uploadFile('event-files', ev.id, file);
    if (error || !path) {
      setUploading(false);
      toast.error(error ?? 'Erro no upload.');
      return;
    }
    await supabase.from('documents').insert({
      name: file.name,
      category: 'Outros',
      file_path: `event-files:${path}`,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: profile?.id ?? null,
      related_type: 'event',
      related_id: ev.id,
    });
    setUploading(false);
    toast.success('Documento enviado.');
    void documents.refetch();
  };

  const removeDocument = async (doc: DocumentItem) => {
    const [bucket, ...rest] = doc.file_path.split(':');
    await deleteFile(bucket, rest.join(':'));
    await supabase.from('documents').delete().eq('id', doc.id);
    void documents.refetch();
  };

  const downloadDocument = (doc: DocumentItem) => {
    const [bucket, ...rest] = doc.file_path.split(':');
    void downloadFile(bucket, rest.join(':'), doc.name);
  };

  return (
    <div>
      <PageHeader
        title={ev.name}
        description={ev.category ?? undefined}
        breadcrumbs={[
          { label: 'Início', to: '/' },
          { label: 'Eventos', to: '/eventos' },
          { label: ev.name },
        ]}
        actions={
          canManage && (
            <>
              <Button variant="outline" icon={<Pencil size={16} />} onClick={openEdit}>
                Editar
              </Button>
              <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setConfirmDelete(true)}>
                Excluir
              </Button>
            </>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-[var(--color-text-secondary)]">
        <Badge tone={eventStatusTones[ev.status]}>{eventStatusLabels[ev.status]}</Badge>
        <span className="flex items-center gap-1.5">
          <CalendarDays size={14} aria-hidden />
          {formatDate(ev.start_date)}
          {ev.end_date && ev.end_date !== ev.start_date && ` — ${formatDate(ev.end_date)}`}
        </span>
        {ev.location && (
          <span className="flex items-center gap-1.5">
            <MapPin size={14} aria-hidden />
            {ev.location}
          </span>
        )}
        {ev.responsible && (
          <span className="flex items-center gap-1.5">
            <Avatar name={ev.responsible.full_name} src={ev.responsible.avatar_url} size="xs" />
            {ev.responsible.full_name}
          </span>
        )}
      </div>

      <Tabs
        tabs={[
          { id: 'overview', label: 'Visão geral' },
          { id: 'tasks', label: 'Tarefas', count: stats.total },
          { id: 'timeline', label: 'Cronograma', count: (timeline.data ?? []).length },
          { id: 'team', label: 'Equipe', count: (team.data ?? []).length },
          ...(canFinance ? [{ id: 'finance', label: 'Financeiro' }] : []),
          { id: 'documents', label: 'Documentos', count: (documents.data ?? []).length },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-4"
      />

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard title="Tarefas concluídas" value={`${stats.done}/${stats.total}`} />
            <KpiCard title="Tarefas atrasadas" value={stats.overdue} tone={stats.overdue > 0 ? 'danger' : 'default'} />
            {canFinance && (
              <>
                <KpiCard title="Gastos" value={formatCurrency(stats.spent)} tone="danger" />
                <KpiCard
                  title="Orçamento"
                  value={ev.budget ? formatCurrency(ev.budget) : '—'}
                  hint={ev.budget ? `${Math.round((stats.spent / ev.budget) * 100)}% utilizado` : undefined}
                />
              </>
            )}
          </div>

          {stats.total > 0 && (
            <Card className="p-4">
              <ProgressBar value={stats.done} max={stats.total} label="Progresso das tarefas" />
            </Card>
          )}
          {canFinance && ev.budget != null && ev.budget > 0 && (
            <Card className="p-4">
              <ProgressBar value={stats.spent} max={ev.budget} label="Orçamento utilizado" />
            </Card>
          )}

          {ev.description && (
            <Card className="p-4">
              <h3 className="mb-1 text-sm font-semibold">Descrição</h3>
              <p className="whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">{ev.description}</p>
            </Card>
          )}

          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold">Próximos marcos</h3>
            {(timeline.data ?? []).filter((m) => !m.is_done).length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">Nenhum marco pendente.</p>
            ) : (
              <ul className="space-y-1.5">
                {(timeline.data ?? [])
                  .filter((m) => !m.is_done)
                  .slice(0, 5)
                  .map((m) => (
                    <li key={m.id} className="flex items-center justify-between text-sm">
                      <span>{m.title}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">{formatDate(m.date)}</span>
                    </li>
                  ))}
              </ul>
            )}
          </Card>

          {ev.notes && (
            <Card className="p-4">
              <h3 className="mb-1 text-sm font-semibold">Observações</h3>
              <p className="whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">{ev.notes}</p>
            </Card>
          )}
        </div>
      )}

      {tab === 'tasks' && (
        <div className="space-y-3">
          {canManage && (
            <Button
              size="sm"
              icon={<Plus size={15} />}
              onClick={() => {
                setSelectedTask(null);
                setTaskModalOpen(true);
              }}
            >
              Nova tarefa do evento
            </Button>
          )}
          {(tasks.data ?? []).length === 0 ? (
            <EmptyState title="Sem tarefas" description="Crie tarefas vinculadas a este evento para acompanhar o preparo." />
          ) : (
            <Card>
              <ul className="divide-y divide-[var(--color-border)]">
                {(tasks.data ?? []).map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => {
                        setSelectedTask(t);
                        setTaskModalOpen(true);
                      }}
                      className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-[var(--color-surface-hover)]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{t.title}</span>
                        <span className="text-xs text-[var(--color-text-muted)]">Prazo: {formatDate(t.due_date)}</span>
                      </span>
                      <Badge tone={taskStatusTones[t.status]}>{taskStatusLabels[t.status]}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {tab === 'timeline' && (
        <div className="space-y-3">
          {canManage && (
            <Card className="p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Input
                  label="Novo marco"
                  placeholder="Ex.: Fechar contrato do local"
                  value={newMilestone.title}
                  onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })}
                />
                <Input
                  label="Data"
                  type="date"
                  value={newMilestone.date}
                  onChange={(e) => setNewMilestone({ ...newMilestone, date: e.target.value })}
                />
                <Button icon={<Plus size={16} />} onClick={() => void addMilestone()}>
                  Adicionar
                </Button>
              </div>
            </Card>
          )}
          {(timeline.data ?? []).length === 0 ? (
            <EmptyState title="Cronograma vazio" description="Adicione marcos para acompanhar o preparo do evento." />
          ) : (
            <Card className="p-4">
              <ol className="relative space-y-3 border-l-2 border-[var(--color-border)] pl-5">
                {(timeline.data ?? []).map((m) => (
                  <li key={m.id} className="group relative flex items-center gap-2">
                    <button
                      aria-label={m.is_done ? 'Marcar como pendente' : 'Marcar como concluído'}
                      onClick={() => void toggleMilestone(m)}
                      className="absolute -left-[31px] bg-[var(--color-surface)] text-[var(--color-primary)]"
                    >
                      {m.is_done ? <CheckCircle2 size={20} /> : <Circle size={20} className="text-[var(--color-border-strong)]" />}
                    </button>
                    <span className={m.is_done ? 'text-sm line-through opacity-60' : 'text-sm'}>{m.title}</span>
                    <span className="ml-auto text-xs text-[var(--color-text-muted)]">{formatDate(m.date)}</span>
                    {canManage && (
                      <button
                        aria-label={`Remover marco ${m.title}`}
                        onClick={() => void removeMilestone(m)}
                        className="text-[var(--color-text-muted)] opacity-0 transition-opacity hover:text-[var(--color-danger)] group-hover:opacity-100"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      )}

      {tab === 'team' && (
        <div className="space-y-3">
          {canManage && (
            <Card className="p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Select
                  label="Adicionar à equipe"
                  options={(profiles.data ?? []).map((p) => ({ value: p.id, label: p.full_name }))}
                  placeholder="Selecione um usuário…"
                  value={newTeamMember.profile_id}
                  onChange={(e) => setNewTeamMember({ ...newTeamMember, profile_id: e.target.value })}
                />
                <Input
                  label="Função no evento"
                  placeholder="Ex.: Coordenação de bar"
                  value={newTeamMember.role}
                  onChange={(e) => setNewTeamMember({ ...newTeamMember, role: e.target.value })}
                />
                <Button icon={<Plus size={16} />} onClick={() => void addTeamMember()}>
                  Adicionar
                </Button>
              </div>
            </Card>
          )}
          {(team.data ?? []).length === 0 ? (
            <EmptyState icon={<Users size={24} />} title="Equipe vazia" description="Adicione membros responsáveis por este evento." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(team.data ?? []).map((tm) => (
                <Card key={tm.profile_id} className="flex items-center gap-3 p-4">
                  <Avatar name={tm.profile?.full_name} src={tm.profile?.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{tm.profile?.full_name}</p>
                    <p className="truncate text-xs text-[var(--color-text-muted)]">{tm.role_in_event ?? 'Equipe'}</p>
                  </div>
                  {canManage && (
                    <IconButton label="Remover da equipe" size="sm" onClick={() => void removeTeamMember(tm.profile_id)}>
                      <X size={15} className="text-[var(--color-danger)]" />
                    </IconButton>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'finance' && canFinance && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <KpiCard title="Receitas do evento" value={formatCurrency(stats.income)} tone="success" />
            <KpiCard title="Despesas do evento" value={formatCurrency(stats.spent)} tone="danger" />
            <KpiCard
              title="Resultado"
              value={formatCurrency(stats.income - stats.spent)}
              tone={stats.income - stats.spent >= 0 ? 'success' : 'danger'}
            />
          </div>
          {(transactions.data ?? []).length === 0 ? (
            <EmptyState
              title="Sem movimentações"
              description="Lance receitas e despesas vinculadas a este evento no módulo Financeiro."
              actionLabel="Abrir Financeiro"
              onAction={() => navigate('/financeiro')}
            />
          ) : (
            <Card>
              <ul className="divide-y divide-[var(--color-border)]">
                {(transactions.data ?? []).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 px-4 py-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{t.description}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {formatDate(t.date)} · {t.category?.name ?? 'Sem categoria'}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone={transactionStatusTones[t.status]}>{transactionStatusLabels[t.status]}</Badge>
                      <span
                        className={
                          t.type === 'income'
                            ? 'text-sm font-semibold text-[var(--color-success)]'
                            : 'text-sm font-semibold text-[var(--color-danger)]'
                        }
                      >
                        {t.type === 'income' ? '+' : '−'} {formatCurrency(t.amount)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {tab === 'documents' && (
        <div className="space-y-3">
          {can('documents.manage') && (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)]">
              <Upload size={15} aria-hidden />
              {uploading ? 'Enviando…' : 'Enviar documento'}
              <input
                type="file"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onUploadDocument(file);
                  e.target.value = '';
                }}
              />
            </label>
          )}
          {(documents.data ?? []).length === 0 ? (
            <EmptyState title="Sem documentos" description="Envie contratos, orçamentos e artes relacionadas a este evento." />
          ) : (
            <Card>
              <ul className="divide-y divide-[var(--color-border)]">
                {(documents.data ?? []).map((doc) => (
                  <li key={doc.id} className="flex items-center gap-2 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{doc.name}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {formatFileSize(doc.file_size)} · {formatDate(doc.created_at)} · {doc.uploader?.full_name ?? '—'}
                      </span>
                    </span>
                    <IconButton label={`Baixar ${doc.name}`} size="sm" onClick={() => downloadDocument(doc)}>
                      <Download size={15} />
                    </IconButton>
                    {can('documents.manage') && (
                      <IconButton label={`Excluir ${doc.name}`} size="sm" onClick={() => void removeDocument(doc)}>
                        <Trash2 size={15} className="text-[var(--color-danger)]" />
                      </IconButton>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar evento"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={(e) => void saveEdit(e as unknown as FormEvent)}>
              Salvar alterações
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => void saveEdit(e)} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input label="Nome" required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <Select
            label="Categoria"
            options={eventCategories.map((c) => ({ value: c, label: c }))}
            placeholder="Selecione…"
            value={editForm.category}
            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
          />
          <Select
            label="Status"
            options={Object.entries(eventStatusLabels).map(([value, label]) => ({ value, label }))}
            value={editForm.status}
            onChange={(e) => setEditForm({ ...editForm, status: e.target.value as EventStatus })}
          />
          <Input label="Data inicial" type="date" value={editForm.start_date} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} />
          <Input label="Data final" type="date" value={editForm.end_date} onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })} />
          <Input label="Local" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
          <Input label="Endereço" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
          <Input
            label="Público esperado"
            type="number"
            min={0}
            value={editForm.expected_attendance}
            onChange={(e) => setEditForm({ ...editForm, expected_attendance: e.target.value })}
          />
          <Input
            label="Público real"
            type="number"
            min={0}
            value={editForm.actual_attendance}
            onChange={(e) => setEditForm({ ...editForm, actual_attendance: e.target.value })}
          />
          <Input
            label="Orçamento (R$)"
            type="number"
            min={0}
            step="0.01"
            value={editForm.budget}
            onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })}
          />
          <Select
            label="Responsável"
            options={(profiles.data ?? []).map((p) => ({ value: p.id, label: p.full_name }))}
            placeholder="Selecione…"
            value={editForm.responsible_id}
            onChange={(e) => setEditForm({ ...editForm, responsible_id: e.target.value })}
          />
          <div className="sm:col-span-2">
            <Textarea label="Descrição" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Textarea label="Observações" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={deleteEvent}
        title="Excluir evento"
        message={`Tem certeza que deseja excluir "${ev.name}"? As tarefas vinculadas perderão a referência ao evento.`}
        confirmLabel="Excluir"
      />

      <TaskModal
        open={taskModalOpen}
        task={selectedTask}
        defaultEventId={ev.id}
        profiles={profiles.data ?? []}
        departments={departments.data ?? []}
        events={[{ id: ev.id, name: ev.name }]}
        onClose={() => setTaskModalOpen(false)}
        onSaved={() => void tasks.refetch()}
      />
    </div>
  );
}
