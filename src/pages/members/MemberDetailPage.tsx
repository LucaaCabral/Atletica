import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { differenceInCalendarDays, differenceInCalendarMonths } from 'date-fns';
import { Mail, Phone, Trash2, UserX, UserCheck, History } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useQuery } from '@/hooks/useQuery';
import { logActivity } from '@/services/activityLog';
import type { ActivityLog, Member, Task } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, taskStatusTones } from '@/components/ui/Badge';
import { ConfirmModal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, FullPageSpinner } from '@/components/ui/State';
import { formatDate, formatRelative } from '@/utils/format';
import { taskStatusLabels } from '@/utils/labels';

export function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const canManage = can('members.manage');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [working, setWorking] = useState(false);

  const member = useQuery<Member | null>(async () => {
    const { data, error } = await supabase
      .from('members')
      .select('*, sector:sectors(*), position:positions(*)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as Member | null;
  }, [id]);

  const tasks = useQuery<Task[]>(async () => {
    if (!member.data?.user_id) return [];
    const { data, error } = await supabase
      .from('task_assignees')
      .select('task:tasks(*)')
      .eq('profile_id', member.data.user_id)
      .limit(20);
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as { task: Task | null }[])
      .map((r) => r.task)
      .filter((t): t is Task => t !== null);
  }, [member.data?.user_id]);

  const eventCount = useQuery<number>(async () => {
    if (!member.data?.user_id) return 0;
    const { count } = await supabase
      .from('event_members')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', member.data.user_id);
    return count ?? 0;
  }, [member.data?.user_id]);

  const timeline = useQuery<ActivityLog[]>(async () => {
    if (!member.data?.user_id) return [];
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', member.data.user_id)
      .order('created_at', { ascending: false })
      .limit(15);
    if (error) throw new Error(error.message);
    return (data ?? []) as ActivityLog[];
  }, [member.data?.user_id]);

  if (member.loading) return <FullPageSpinner />;
  if (member.error) return <ErrorState message={member.error} onRetry={() => void member.refetch()} />;
  if (!member.data) {
    return <ErrorState message="Membro não encontrado." onRetry={() => navigate('/membros')} />;
  }

  const m = member.data;
  const doneCount = (tasks.data ?? []).filter((t) => t.status === 'done').length;
  const openCount = (tasks.data ?? []).filter((t) => !['done', 'cancelled'].includes(t.status)).length;

  const tenureText = (() => {
    if (!m.joined_at) return null;
    const start = new Date(`${m.joined_at}T00:00:00`);
    const end = m.left_at ? new Date(`${m.left_at}T00:00:00`) : new Date();
    const months = differenceInCalendarMonths(end, start);
    if (months >= 1) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
    const days = differenceInCalendarDays(end, start);
    return `${days} ${days === 1 ? 'dia' : 'dias'}`;
  })();

  const toggleStatus = async () => {
    setWorking(true);
    const newStatus = m.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase
      .from('members')
      .update({ status: newStatus, left_at: newStatus === 'inactive' ? new Date().toISOString().slice(0, 10) : null })
      .eq('id', m.id);
    setWorking(false);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    toast.success(newStatus === 'active' ? 'Membro reativado.' : 'Membro desativado.');
    void logActivity({
      action: 'update',
      module: 'membros',
      entityType: 'member',
      entityId: m.id,
      summary: `${newStatus === 'active' ? 'Reativou' : 'Desativou'} o membro ${m.full_name}`,
    });
    void member.refetch();
  };

  const deleteMember = async () => {
    setWorking(true);
    const { error } = await supabase.from('members').delete().eq('id', m.id);
    setWorking(false);
    if (error) {
      toast.error(`Erro ao excluir: ${error.message}`);
      return;
    }
    toast.success('Membro excluído.');
    void logActivity({
      action: 'delete',
      module: 'membros',
      entityType: 'member',
      entityId: m.id,
      summary: `Excluiu o membro ${m.full_name}`,
    });
    navigate('/membros');
  };

  return (
    <div>
      <PageHeader
        title={m.full_name}
        breadcrumbs={[
          { label: 'Início', to: '/' },
          { label: 'Membros', to: '/membros' },
          { label: m.full_name },
        ]}
        actions={
          canManage && (
            <>
              <Button
                variant="outline"
                icon={m.status === 'active' ? <UserX size={16} /> : <UserCheck size={16} />}
                loading={working}
                onClick={() => void toggleStatus()}
              >
                {m.status === 'active' ? 'Desativar' : 'Reativar'}
              </Button>
              <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setConfirmDelete(true)}>
                Excluir
              </Button>
            </>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <div className="flex flex-col items-center gap-3 text-center">
            <Avatar name={m.full_name} src={m.photo_url} size="xl" />
            <div>
              <p className="text-lg font-semibold">{m.full_name}</p>
              {m.nickname && <p className="text-sm text-[var(--color-text-muted)]">“{m.nickname}”</p>}
            </div>
            <Badge tone={m.status === 'active' ? 'success' : 'neutral'}>
              {m.status === 'active' ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>

          <dl className="mt-5 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Setor</dt>
              <dd>{m.sector?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Cargo</dt>
              <dd>{m.position?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Entrada</dt>
              <dd>{formatDate(m.joined_at)}</dd>
            </div>
            {tenureText && (
              <div>
                <dt className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Tempo de gestão</dt>
                <dd>{tenureText}</dd>
              </div>
            )}
            {m.left_at && (
              <div>
                <dt className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Saída</dt>
                <dd>{formatDate(m.left_at)}</dd>
              </div>
            )}
            {m.email && (
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-[var(--color-text-muted)]" aria-hidden />
                <a href={`mailto:${m.email}`} className="text-[var(--color-primary)] hover:underline">
                  {m.email}
                </a>
              </div>
            )}
            {m.phone && (
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-[var(--color-text-muted)]" aria-hidden />
                <span>{m.phone}</span>
              </div>
            )}
          </dl>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {(m.bio || m.responsibilities) && (
            <Card className="p-5">
              {m.bio && (
                <div className="mb-4">
                  <h3 className="mb-1 text-sm font-semibold">Sobre</h3>
                  <p className="whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">{m.bio}</p>
                </div>
              )}
              {m.responsibilities && (
                <div>
                  <h3 className="mb-1 text-sm font-semibold">Responsabilidades</h3>
                  <p className="whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">
                    {m.responsibilities}
                  </p>
                </div>
              )}
            </Card>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <p className="text-xl font-bold">{openCount + doneCount}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">Tarefas</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-xl font-bold">{eventCount.data ?? 0}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">Eventos</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-xl font-bold">{tenureText ?? '—'}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">Na gestão</p>
            </Card>
          </div>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Tarefas atribuídas</h3>
              <div className="flex gap-2 text-xs text-[var(--color-text-secondary)]">
                <Badge tone="info">{openCount} em aberto</Badge>
                <Badge tone="success">{doneCount} concluídas</Badge>
              </div>
            </div>
            {!m.user_id ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                Este membro ainda não está vinculado a um usuário do sistema, então não possui tarefas atribuídas.
              </p>
            ) : (tasks.data ?? []).length === 0 ? (
              <EmptyState title="Sem tarefas" description="Nenhuma tarefa atribuída a este membro." />
            ) : (
              <ul className="space-y-2">
                {(tasks.data ?? []).map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => navigate(`/tarefas?task=${t.id}`)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-[var(--color-surface-hover)]"
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
            )}
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <History size={15} className="text-[var(--color-text-muted)]" aria-hidden />
              Linha do tempo
            </h3>
            {!m.user_id ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                Sem histórico: este membro ainda não está vinculado a um usuário do sistema.
              </p>
            ) : (timeline.data ?? []).length === 0 ? (
              <EmptyState title="Sem atividade registrada" description="As ações deste membro no sistema aparecerão aqui." />
            ) : (
              <ol className="relative space-y-3 border-l-2 border-[var(--color-border)] pl-5">
                {(timeline.data ?? []).map((log) => (
                  <li key={log.id} className="relative">
                    <span
                      aria-hidden
                      className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]"
                    />
                    <p className="text-sm">{log.summary ?? `${log.action} em ${log.module}`}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{formatRelative(log.created_at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {m.notes && (
            <Card className="p-5">
              <h3 className="mb-1 text-sm font-semibold">Observações</h3>
              <p className="whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">{m.notes}</p>
            </Card>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={deleteMember}
        loading={working}
        title="Excluir membro"
        message={`Tem certeza que deseja excluir ${m.full_name}? Esta ação não pode ser desfeita. Se o membro apenas saiu da Atlética, prefira desativá-lo.`}
        confirmLabel="Excluir definitivamente"
      />
    </div>
  );
}
