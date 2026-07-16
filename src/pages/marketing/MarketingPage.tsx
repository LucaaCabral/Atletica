import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Megaphone, Send, ThumbsUp, MessageSquareWarning } from 'lucide-react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useQuery } from '@/hooks/useQuery';
import { logActivity } from '@/services/activityLog';
import type {
  Sector,
  Event,
  MarketingApproval,
  MarketingComment,
  MarketingRequest,
  MarketingStatus,
  Profile,
  TaskPriority,
} from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge, marketingStatusTones, priorityTones } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/State';
import { marketingStatusLabels, marketingStatusOrder, taskPriorityLabels } from '@/utils/labels';
import { formatDate, formatRelative } from '@/utils/format';
import { cn } from '@/utils/cn';

const KANBAN_STATUSES: MarketingStatus[] = [
  'received',
  'in_analysis',
  'in_production',
  'awaiting_approval',
  'changes_requested',
  'approved',
  'scheduled',
  'published',
];

export function MarketingPage() {
  const { profile, can } = useAuth();
  const toast = useToast();
  const canManage = can('marketing.manage');

  const [tab, setTab] = useState('board');
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<MarketingRequest | null>(null);
  const [comments, setComments] = useState<MarketingComment[]>([]);
  const [approvals, setApprovals] = useState<MarketingApproval[]>([]);
  const [newComment, setNewComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', sector_id: '', event_id: '', description: '', briefing: '',
    format: '', channel: '', due_date: '', priority: 'medium' as TaskPriority,
  });

  const requests = useQuery<MarketingRequest[]>(async () => {
    const { data, error } = await supabase
      .from('marketing_requests')
      .select(
        '*, requester:profiles!marketing_requests_requester_id_fkey(id, full_name, avatar_url), assignee:profiles!marketing_requests_assignee_id_fkey(id, full_name, avatar_url), event:events(id, name), sector:sectors(id, name)',
      )
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as MarketingRequest[];
  });

  const departments = useQuery<Sector[]>(async () => {
    const { data } = await supabase.from('sectors').select('*').order('name');
    return (data ?? []) as Sector[];
  });

  const events = useQuery<Pick<Event, 'id' | 'name'>[]>(async () => {
    const { data } = await supabase.from('events').select('id, name').order('start_date', { ascending: false });
    return (data ?? []) as Pick<Event, 'id' | 'name'>[];
  });

  const profiles = useQuery<Profile[]>(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('is_active', true).order('full_name');
    return (data ?? []) as Profile[];
  });

  const openDetail = async (req: MarketingRequest) => {
    setSelected(req);
    const [cm, ap] = await Promise.all([
      supabase
        .from('marketing_comments')
        .select('*, author:profiles(id, full_name, avatar_url)')
        .eq('request_id', req.id)
        .order('created_at'),
      supabase
        .from('marketing_approvals')
        .select('*, approver:profiles(id, full_name)')
        .eq('request_id', req.id)
        .order('created_at', { ascending: false }),
    ]);
    setComments((cm.data ?? []) as MarketingComment[]);
    setApprovals((ap.data ?? []) as MarketingApproval[]);
  };

  const createRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (form.title.trim().length < 3) {
      toast.error('Informe o título da solicitação.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('marketing_requests').insert({
      title: form.title.trim(),
      requester_id: profile?.id ?? null,
      sector_id: form.sector_id || null,
      event_id: form.event_id || null,
      description: form.description.trim() || null,
      briefing: form.briefing.trim() || null,
      format: form.format.trim() || null,
      channel: form.channel.trim() || null,
      due_date: form.due_date || null,
      priority: form.priority,
    });
    setSaving(false);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    toast.success('Solicitação enviada ao Marketing.');
    void logActivity({
      action: 'create',
      module: 'marketing',
      entityType: 'marketing_request',
      summary: `Criou o pedido de arte "${form.title.trim()}"`,
    });
    setCreateOpen(false);
    setForm({ title: '', sector_id: '', event_id: '', description: '', briefing: '', format: '', channel: '', due_date: '', priority: 'medium' });
    void requests.refetch();
  };

  const updateRequest = async (fields: Partial<MarketingRequest>) => {
    if (!selected) return;
    const { error } = await supabase.from('marketing_requests').update(fields).eq('id', selected.id);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    if (fields.status) {
      void logActivity({
        action: 'status_change',
        module: 'marketing',
        entityType: 'marketing_request',
        entityId: selected.id,
        summary: `Alterou "${selected.title}" para ${marketingStatusLabels[fields.status]}`,
      });
    }
    setSelected({ ...selected, ...fields });
    void requests.refetch();
  };

  const decide = async (decision: 'approved' | 'changes_requested') => {
    if (!selected || !profile) return;
    const { error } = await supabase.from('marketing_approvals').insert({
      request_id: selected.id,
      approver_id: profile.id,
      decision,
    });
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    await updateRequest({ status: decision === 'approved' ? 'approved' : 'changes_requested' });
    toast.success(decision === 'approved' ? 'Solicitação aprovada.' : 'Ajustes solicitados.');
    void openDetail(selected);
  };

  const addComment = async () => {
    if (!selected || !profile || !newComment.trim()) return;
    const { error } = await supabase.from('marketing_comments').insert({
      request_id: selected.id,
      author_id: profile.id,
      content: newComment.trim(),
    });
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    setNewComment('');
    void openDetail(selected);
  };

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [calendarMonth]);

  const canApprove = profile && ['admin', 'director', 'marketing'].includes(profile.role);

  return (
    <div>
      <PageHeader
        title="Marketing"
        description="Solicitações de arte, produção e calendário de publicações."
        breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Marketing' }]}
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
            Nova solicitação
          </Button>
        }
      />

      <Tabs
        tabs={[
          { id: 'board', label: 'Kanban' },
          { id: 'list', label: 'Lista', count: (requests.data ?? []).length },
          { id: 'calendar', label: 'Calendário de publicações' },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-4"
      />

      {requests.error ? (
        <ErrorState message={requests.error} onRetry={() => void requests.refetch()} />
      ) : requests.loading ? (
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-64" />
          ))}
        </div>
      ) : (requests.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Megaphone size={24} />}
          title="Nenhuma solicitação de marketing"
          description="Peça artes, posts e materiais de divulgação para o setor de Marketing."
          actionLabel="Criar solicitação"
          onAction={() => setCreateOpen(true)}
        />
      ) : tab === 'board' ? (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {KANBAN_STATUSES.map((status) => {
            const items = (requests.data ?? []).filter((r) => r.status === status);
            return (
              <div key={status} className="w-64 shrink-0 rounded-xl bg-[var(--color-surface-secondary)] sm:w-72">
                <div className="flex items-center justify-between px-3 py-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                    {marketingStatusLabels[status]}
                  </h3>
                  <span className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-xs font-medium">{items.length}</span>
                </div>
                <div className="flex flex-col gap-2 px-2 pb-2" style={{ maxHeight: '60dvh', overflowY: 'auto' }}>
                  {items.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => void openDetail(r)}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left shadow-[var(--shadow-card)] hover:border-[var(--color-primary)]"
                    >
                      <p className="text-sm font-medium leading-snug">{r.title}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <Badge tone={priorityTones[r.priority]}>{taskPriorityLabels[r.priority]}</Badge>
                        {r.due_date && (
                          <span className="text-[11px] text-[var(--color-text-muted)]">{formatDate(r.due_date, 'dd/MM')}</span>
                        )}
                      </div>
                      {r.event?.name && (
                        <p className="mt-1 truncate text-[11px] text-[var(--color-text-muted)]">{r.event.name}</p>
                      )}
                    </button>
                  ))}
                  {items.length === 0 && (
                    <p className="px-2 py-3 text-center text-xs text-[var(--color-text-muted)]">Vazio</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : tab === 'list' ? (
        <Card>
          <ul className="divide-y divide-[var(--color-border)]">
            {(requests.data ?? []).map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => void openDetail(r)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-[var(--color-surface-hover)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{r.title}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {r.requester?.full_name ?? '—'} · {r.sector?.name ?? 'Sem setor'} · prazo {formatDate(r.due_date)}
                    </span>
                  </span>
                  <Badge tone={marketingStatusTones[r.status]}>{marketingStatusLabels[r.status]}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold capitalize">{format(calendarMonth, 'MMMM yyyy', { locale: ptBR })}</h3>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setCalendarMonth((m) => addMonths(m, -1))}>
                Anterior
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
              const posts = (requests.data ?? []).filter((r) => r.publish_date === dayStr);
              return (
                <div key={dayStr} className={cn('min-h-20 bg-[var(--color-surface)] p-1', !isSameMonth(day, calendarMonth) && 'opacity-40')}>
                  <p className="mb-0.5 text-right text-[11px] text-[var(--color-text-muted)]">{format(day, 'd')}</p>
                  {posts.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => void openDetail(r)}
                      className="mb-0.5 block w-full truncate rounded bg-[var(--color-info-soft)] px-1 py-0.5 text-left text-[10px] text-[var(--color-info)]"
                      title={r.title}
                    >
                      {r.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nova solicitação de marketing"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={(e) => void createRequest(e as unknown as FormEvent)}>
              Enviar solicitação
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => void createRequest(e)} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input label="Título" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <Select
            label="Setor solicitante"
            options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
            placeholder="Selecione…"
            value={form.sector_id}
            onChange={(e) => setForm({ ...form, sector_id: e.target.value })}
          />
          <Select
            label="Evento relacionado"
            options={(events.data ?? []).map((ev) => ({ value: ev.id, label: ev.name }))}
            placeholder="Nenhum"
            value={form.event_id}
            onChange={(e) => setForm({ ...form, event_id: e.target.value })}
          />
          <Input label="Formato" placeholder="Post, story, cartaz…" value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} />
          <Input label="Canal" placeholder="Instagram, WhatsApp…" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} />
          <Input label="Prazo" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          <Select
            label="Prioridade"
            options={Object.entries(taskPriorityLabels).map(([value, label]) => ({ value, label }))}
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
          />
          <div className="sm:col-span-2">
            <Textarea label="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              label="Briefing"
              hint="Textos, referências, informações obrigatórias na arte."
              value={form.briefing}
              onChange={(e) => setForm({ ...form, briefing: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.title ?? ''}
        size="xl"
      >
        {selected && (
          <div className="grid gap-5 lg:grid-cols-5">
            <div className="space-y-4 lg:col-span-3">
              {selected.description && (
                <div>
                  <p className="text-sm font-medium">Descrição</p>
                  <p className="whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">{selected.description}</p>
                </div>
              )}
              {selected.briefing && (
                <div>
                  <p className="text-sm font-medium">Briefing</p>
                  <p className="whitespace-pre-wrap rounded-lg bg-[var(--color-surface-secondary)] p-3 text-sm text-[var(--color-text-secondary)]">
                    {selected.briefing}
                  </p>
                </div>
              )}

              <div>
                <p className="mb-1.5 text-sm font-medium">Histórico de aprovações</p>
                {approvals.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-muted)]">Nenhuma decisão registrada.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {approvals.map((ap) => (
                      <li key={ap.id} className="flex items-center gap-2 text-sm">
                        <Badge tone={ap.decision === 'approved' ? 'success' : 'danger'}>
                          {ap.decision === 'approved' ? 'Aprovado' : 'Ajustes'}
                        </Badge>
                        <span>{ap.approver?.full_name ?? 'Usuário'}</span>
                        <span className="text-xs text-[var(--color-text-muted)]">{formatRelative(ap.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium">Comentários</p>
                <ul className="space-y-3">
                  {comments.map((c) => (
                    <li key={c.id} className="flex gap-2.5">
                      <Avatar name={c.author?.full_name} src={c.author?.avatar_url} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{c.author?.full_name ?? 'Usuário'}</span>{' '}
                          <span className="text-xs text-[var(--color-text-muted)]">{formatRelative(c.created_at)}</span>
                        </p>
                        <p className="whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">{c.content}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-2">
                  <input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void addComment();
                      }
                    }}
                    placeholder="Escreva um comentário…"
                    aria-label="Novo comentário"
                    className="h-9 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
                  />
                  <IconButton label="Enviar comentário" variant="primary" onClick={() => void addComment()}>
                    <Send size={15} />
                  </IconButton>
                </div>
              </div>
            </div>

            <div className="space-y-4 lg:col-span-2">
              <Select
                label="Status"
                options={marketingStatusOrder.map((s) => ({ value: s, label: marketingStatusLabels[s] }))}
                value={selected.status}
                onChange={(e) => void updateRequest({ status: e.target.value as MarketingStatus })}
                disabled={!canManage}
              />
              <Select
                label="Responsável (Marketing)"
                options={(profiles.data ?? []).map((p) => ({ value: p.id, label: p.full_name }))}
                placeholder="Não atribuído"
                value={selected.assignee_id ?? ''}
                onChange={(e) => void updateRequest({ assignee_id: e.target.value || null })}
                disabled={!canManage}
              />
              <Input
                label="Data de publicação"
                type="date"
                value={selected.publish_date ?? ''}
                onChange={(e) => void updateRequest({ publish_date: e.target.value || null })}
                disabled={!canManage}
              />
              <dl className="space-y-2 rounded-lg bg-[var(--color-surface-secondary)] p-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Solicitante</dt>
                  <dd>{selected.requester?.full_name ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Setor</dt>
                  <dd>{selected.sector?.name ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Evento</dt>
                  <dd>{selected.event?.name ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Formato</dt>
                  <dd>{selected.format ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Canal</dt>
                  <dd>{selected.channel ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Prazo</dt>
                  <dd>{formatDate(selected.due_date)}</dd>
                </div>
              </dl>

              {canApprove && selected.status === 'awaiting_approval' && (
                <div className="flex flex-col gap-2">
                  <Button icon={<ThumbsUp size={16} />} onClick={() => void decide('approved')}>
                    Aprovar
                  </Button>
                  <Button
                    variant="outline"
                    icon={<MessageSquareWarning size={16} />}
                    onClick={() => void decide('changes_requested')}
                  >
                    Solicitar ajustes
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
