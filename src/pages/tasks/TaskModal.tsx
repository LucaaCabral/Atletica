import { useEffect, useMemo, useState } from 'react';
import { Copy, Archive, Trash2, Plus, Send, Paperclip, X, Download, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSettings } from '@/contexts/SettingsContext';
import { logActivity } from '@/services/activityLog';
import { uploadFile, deleteFile, downloadFile } from '@/services/storage';
import type {
  Sector,
  Event,
  Profile,
  Task,
  TaskAttachment,
  TaskChecklistItem,
  TaskComment,
  TaskPriority,
  TaskRecurrenceType,
  TaskStatus,
} from '@/types';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Input, Select, Textarea, Checkbox } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { ProgressBar } from '@/components/ui/Card';
import { taskPriorityLabels, taskRecurrenceLabels, taskStatusLabels, taskStatusOrder } from '@/utils/labels';
import { formatRelative, formatFileSize, isOverdue } from '@/utils/format';
import { generateNextOccurrence } from '@/services/recurrence';
import { cn } from '@/utils/cn';

interface TaskModalProps {
  open: boolean;
  task: Task | null;
  defaultEventId?: string;
  defaultSectorId?: string;
  profiles: Profile[];
  departments: Sector[];
  events: Pick<Event, 'id' | 'name'>[];
  onClose: () => void;
  onSaved: () => void;
}

interface TaskForm {
  title: string;
  description: string;
  sector_id: string;
  event_id: string;
  priority: TaskPriority;
  status: TaskStatus;
  start_date: string;
  due_date: string;
  labels: string[];
  recurrence_type: TaskRecurrenceType | '';
  recurrence_interval_days: string;
}

const emptyForm: TaskForm = {
  title: '',
  description: '',
  sector_id: '',
  event_id: '',
  priority: 'medium',
  status: 'todo',
  start_date: '',
  due_date: '',
  labels: [],
  recurrence_type: '',
  recurrence_interval_days: '',
};

export function TaskModal({
  open,
  task,
  defaultEventId,
  defaultSectorId,
  profiles,
  departments,
  events,
  onClose,
  onSaved,
}: TaskModalProps) {
  const { profile, can } = useAuth();
  const toast = useToast();
  const { taskLabels } = useSettings();
  const canManage = can('tasks.manage');

  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newComment, setNewComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setForm({
        title: task.title,
        description: task.description ?? '',
        sector_id: task.sector_id ?? '',
        event_id: task.event_id ?? '',
        priority: task.priority,
        status: task.status,
        start_date: task.start_date ?? '',
        due_date: task.due_date ?? '',
        labels: task.labels ?? [],
        recurrence_type: task.recurrence_type ?? '',
        recurrence_interval_days: task.recurrence_interval_days?.toString() ?? '',
      });
      setAssignees((task.assignees ?? []).map((a) => a.profile_id));
      void loadSubResources(task.id);
    } else {
      setForm({ ...emptyForm, event_id: defaultEventId ?? '', sector_id: defaultSectorId ?? '' });
      setAssignees([]);
      setChecklist([]);
      setComments([]);
      setAttachments([]);
      setIsFavorite(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const loadSubResources = async (taskId: string) => {
    if (profile) {
      const { data: fav } = await supabase
        .from('task_favorites')
        .select('task_id')
        .eq('task_id', taskId)
        .eq('profile_id', profile.id)
        .maybeSingle();
      setIsFavorite(Boolean(fav));
    }
    const [cl, cm, at] = await Promise.all([
      supabase.from('task_checklists').select('*').eq('task_id', taskId).order('position'),
      supabase
        .from('task_comments')
        .select('*, author:profiles(id, full_name, avatar_url)')
        .eq('task_id', taskId)
        .order('created_at'),
      supabase.from('task_attachments').select('*').eq('task_id', taskId).order('created_at'),
    ]);
    setChecklist((cl.data ?? []) as TaskChecklistItem[]);
    setComments((cm.data ?? []) as TaskComment[]);
    setAttachments((at.data ?? []) as TaskAttachment[]);
  };

  const availableLabels = useMemo(() => {
    const names = new Set(taskLabels.map((l) => l.name));
    for (const l of form.labels) names.add(l);
    return Array.from(names);
  }, [taskLabels, form.labels]);

  const toggleLabel = (label: string) => {
    setForm((f) => ({
      ...f,
      labels: f.labels.includes(label) ? f.labels.filter((l) => l !== label) : [...f.labels, label],
    }));
  };

  const toggleAssignee = (profileId: string) => {
    setAssignees((prev) =>
      prev.includes(profileId) ? prev.filter((p) => p !== profileId) : [...prev, profileId],
    );
  };

  const save = async () => {
    if (saving) return;
    if (form.title.trim().length < 3) {
      toast.error('Informe um título para a tarefa.');
      return;
    }
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      sector_id: form.sector_id || null,
      event_id: form.event_id || null,
      priority: form.priority,
      status: form.status,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
      labels: form.labels,
      completed_at: form.status === 'done' ? new Date().toISOString() : null,
      recurrence_type: form.recurrence_type || null,
      recurrence_interval_days: form.recurrence_type === 'custom' ? Number(form.recurrence_interval_days) || 7 : null,
    };

    const becameDone = form.status === 'done' && task?.status !== 'done';
    let taskId = task?.id ?? null;
    if (task) {
      const { error } = await supabase.from('tasks').update(payload).eq('id', task.id);
      if (error) {
        setSaving(false);
        toast.error(`Erro ao salvar: ${error.message}`);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from('tasks')
        .insert({ ...payload, created_by: profile?.id ?? null })
        .select('id')
        .single();
      if (error || !data) {
        setSaving(false);
        toast.error(`Erro ao criar: ${error?.message ?? 'desconhecido'}`);
        return;
      }
      taskId = data.id as string;
    }

    if (taskId) {
      const previous = new Set((task?.assignees ?? []).map((a) => a.profile_id));
      const next = new Set(assignees);
      const toAdd = assignees.filter((a) => !previous.has(a));
      const toRemove = Array.from(previous).filter((a) => !next.has(a));
      if (toAdd.length > 0) {
        await supabase.from('task_assignees').insert(toAdd.map((profile_id) => ({ task_id: taskId, profile_id })));
      }
      if (toRemove.length > 0) {
        await supabase.from('task_assignees').delete().eq('task_id', taskId).in('profile_id', toRemove);
      }
    }

    if (becameDone && payload.recurrence_type && task) {
      void generateNextOccurrence({ ...task, ...payload });
    }

    setSaving(false);
    toast.success(task ? 'Tarefa atualizada.' : 'Tarefa criada.');
    void logActivity({
      action: task ? 'update' : 'create',
      module: 'tarefas',
      entityType: 'task',
      entityId: taskId ?? undefined,
      summary: `${task ? 'Atualizou' : 'Criou'} a tarefa "${payload.title}"`,
    });
    onSaved();
    onClose();
  };

  const duplicate = async () => {
    if (!task) return;
    const { error } = await supabase.from('tasks').insert({
      title: `${task.title} (cópia)`,
      description: task.description,
      sector_id: task.sector_id,
      event_id: task.event_id,
      priority: task.priority,
      status: 'todo',
      start_date: task.start_date,
      due_date: task.due_date,
      labels: task.labels,
      created_by: profile?.id ?? null,
    });
    if (error) {
      toast.error(`Erro ao duplicar: ${error.message}`);
      return;
    }
    toast.success('Tarefa duplicada.');
    onSaved();
    onClose();
  };

  const archive = async () => {
    if (!task) return;
    const { error } = await supabase.from('tasks').update({ is_archived: true }).eq('id', task.id);
    if (error) {
      toast.error(`Erro ao arquivar: ${error.message}`);
      return;
    }
    toast.success('Tarefa arquivada.');
    onSaved();
    onClose();
  };

  const removeTask = async () => {
    if (!task) return;
    const { error } = await supabase.from('tasks').delete().eq('id', task.id);
    if (error) {
      toast.error(`Erro ao excluir: ${error.message}`);
      return;
    }
    toast.success('Tarefa excluída.');
    void logActivity({
      action: 'delete',
      module: 'tarefas',
      entityType: 'task',
      entityId: task.id,
      summary: `Excluiu a tarefa "${task.title}"`,
    });
    setConfirmDelete(false);
    onSaved();
    onClose();
  };

  const addChecklistItem = async () => {
    if (!task || !newChecklistItem.trim()) return;
    const { error } = await supabase.from('task_checklists').insert({
      task_id: task.id,
      title: newChecklistItem.trim(),
      position: checklist.length,
    });
    if (!error) {
      setNewChecklistItem('');
      void loadSubResources(task.id);
    }
  };

  const toggleChecklistItem = async (item: TaskChecklistItem) => {
    if (!task) return;
    await supabase.from('task_checklists').update({ is_done: !item.is_done }).eq('id', item.id);
    void loadSubResources(task.id);
  };

  const removeChecklistItem = async (item: TaskChecklistItem) => {
    if (!task) return;
    await supabase.from('task_checklists').delete().eq('id', item.id);
    void loadSubResources(task.id);
  };

  const addComment = async () => {
    if (!task || !newComment.trim() || !profile) return;
    const { error } = await supabase.from('task_comments').insert({
      task_id: task.id,
      author_id: profile.id,
      content: newComment.trim(),
    });
    if (error) {
      toast.error(`Erro ao comentar: ${error.message}`);
      return;
    }
    setNewComment('');
    void loadSubResources(task.id);
  };

  const onUpload = async (file: File) => {
    if (!task || uploading) return;
    setUploading(true);
    const { path, error } = await uploadFile('task-attachments', task.id, file);
    if (error || !path) {
      setUploading(false);
      toast.error(error ?? 'Erro no upload.');
      return;
    }
    await supabase.from('task_attachments').insert({
      task_id: task.id,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: profile?.id ?? null,
    });
    setUploading(false);
    toast.success('Arquivo anexado.');
    void loadSubResources(task.id);
  };

  const removeAttachment = async (att: TaskAttachment) => {
    if (!task) return;
    await deleteFile('task-attachments', att.file_path);
    await supabase.from('task_attachments').delete().eq('id', att.id);
    void loadSubResources(task.id);
  };

  const doneItems = checklist.filter((c) => c.is_done).length;

  const toggleFavorite = async () => {
    if (!task || !profile) return;
    if (isFavorite) {
      await supabase.from('task_favorites').delete().eq('task_id', task.id).eq('profile_id', profile.id);
    } else {
      await supabase.from('task_favorites').insert({ task_id: task.id, profile_id: profile.id });
    }
    setIsFavorite(!isFavorite);
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={task ? 'Detalhes da tarefa' : 'Nova tarefa'}
        size="task"
        footer={
          <>
            {task && (
              <div className="mr-auto flex gap-1">
                <IconButton
                  label={isFavorite ? 'Remover dos favoritos' : 'Fixar como favorita'}
                  onClick={() => void toggleFavorite()}
                >
                  <Star size={16} className={isFavorite ? 'fill-[var(--color-secondary)] text-[var(--color-secondary)]' : ''} />
                </IconButton>
                {canManage && (
                  <>
                    <IconButton label="Duplicar tarefa" onClick={() => void duplicate()}>
                      <Copy size={16} />
                    </IconButton>
                    <IconButton label="Arquivar tarefa" onClick={() => void archive()}>
                      <Archive size={16} />
                    </IconButton>
                    <IconButton label="Excluir tarefa" onClick={() => setConfirmDelete(true)}>
                      <Trash2 size={16} className="text-[var(--color-danger)]" />
                    </IconButton>
                  </>
                )}
              </div>
            )}
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            {canManage && (
              <Button loading={saving} onClick={() => void save()}>
                {task ? 'Salvar alterações' : 'Criar tarefa'}
              </Button>
            )}
          </>
        }
      >
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <Input
              label="Título"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              disabled={!canManage}
            />
            <Textarea
              label="Descrição"
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              disabled={!canManage}
            />

            <div>
              <p className="mb-1.5 text-sm font-medium">Etiquetas</p>
              <div className="flex flex-wrap gap-1.5">
                {availableLabels.length === 0 && (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Cadastre etiquetas em Configurações → Categorias.
                  </p>
                )}
                {availableLabels.map((label) => (
                  <button
                    key={label}
                    type="button"
                    disabled={!canManage}
                    onClick={() => toggleLabel(label)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs transition-colors',
                      form.labels.includes(label)
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {task ? (
              <>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-sm font-medium">Checklist</p>
                    {checklist.length > 0 && (
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {doneItems}/{checklist.length}
                      </span>
                    )}
                  </div>
                  {checklist.length > 0 && <ProgressBar value={doneItems} max={checklist.length} className="mb-2" />}
                  <ul className="space-y-1">
                    {checklist.map((item) => (
                      <li key={item.id} className="group flex items-center gap-2">
                        <Checkbox
                          checked={item.is_done}
                          onChange={() => void toggleChecklistItem(item)}
                          label={item.title}
                        />
                        <button
                          aria-label={`Remover item ${item.title}`}
                          onClick={() => void removeChecklistItem(item)}
                          className="ml-auto text-[var(--color-text-muted)] opacity-0 transition-opacity hover:text-[var(--color-danger)] group-hover:opacity-100"
                        >
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {canManage && (
                    <div className="mt-2 flex gap-2">
                      <input
                        value={newChecklistItem}
                        onChange={(e) => setNewChecklistItem(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void addChecklistItem();
                          }
                        }}
                        placeholder="Novo item do checklist…"
                        aria-label="Novo item do checklist"
                        className="h-9 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
                      />
                      <IconButton label="Adicionar item" variant="secondary" onClick={() => void addChecklistItem()}>
                        <Plus size={16} />
                      </IconButton>
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-1.5 text-sm font-medium">Anexos</p>
                  <ul className="space-y-1.5">
                    {attachments.map((att) => (
                      <li
                        key={att.id}
                        className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
                      >
                        <Paperclip size={14} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{att.file_name}</span>
                        <span className="text-xs text-[var(--color-text-muted)]">{formatFileSize(att.file_size)}</span>
                        <IconButton
                          label={`Baixar ${att.file_name}`}
                          size="sm"
                          onClick={() => void downloadFile('task-attachments', att.file_path, att.file_name)}
                        >
                          <Download size={14} />
                        </IconButton>
                        {canManage && (
                          <IconButton label={`Remover ${att.file_name}`} size="sm" onClick={() => void removeAttachment(att)}>
                            <X size={14} className="text-[var(--color-danger)]" />
                          </IconButton>
                        )}
                      </li>
                    ))}
                  </ul>
                  {canManage && (
                    <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm text-[var(--color-primary)] hover:underline">
                      <Paperclip size={14} aria-hidden />
                      {uploading ? 'Enviando…' : 'Anexar arquivo'}
                      <input
                        type="file"
                        className="sr-only"
                        disabled={uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void onUpload(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
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
              </>
            ) : (
              <p className="rounded-lg bg-[var(--color-surface-secondary)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                Checklist, comentários e anexos ficam disponíveis após criar a tarefa.
              </p>
            )}
          </div>

          <div className="space-y-4 lg:col-span-2">
            <Select
              label="Status"
              options={taskStatusOrder.map((s) => ({ value: s, label: taskStatusLabels[s] }))}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}
              disabled={!canManage}
            />
            <Select
              label="Prioridade"
              options={(Object.keys(taskPriorityLabels) as TaskPriority[]).map((p) => ({
                value: p,
                label: taskPriorityLabels[p],
              }))}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
              disabled={!canManage}
            />
            <Select
              label="Setor"
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
              placeholder="Nenhuma"
              value={form.sector_id}
              onChange={(e) => setForm({ ...form, sector_id: e.target.value })}
              disabled={!canManage}
            />
            <Select
              label="Evento relacionado"
              options={events.map((ev) => ({ value: ev.id, label: ev.name }))}
              placeholder="Nenhum"
              value={form.event_id}
              onChange={(e) => setForm({ ...form, event_id: e.target.value })}
              disabled={!canManage}
            />
            <Input
              label="Data de início"
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              disabled={!canManage}
            />
            <Input
              label="Prazo"
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              disabled={!canManage}
            />
            {isOverdue(form.due_date) && !['done', 'cancelled'].includes(form.status) && (
              <Badge tone="danger">Atrasada</Badge>
            )}
            <Select
              label="Recorrência"
              options={Object.entries(taskRecurrenceLabels).map(([value, label]) => ({ value, label }))}
              placeholder="Não repete"
              value={form.recurrence_type}
              onChange={(e) => setForm({ ...form, recurrence_type: e.target.value as TaskRecurrenceType | '' })}
              disabled={!canManage}
            />
            {form.recurrence_type === 'custom' && (
              <Input
                label="Repetir a cada (dias)"
                type="number"
                min={1}
                value={form.recurrence_interval_days}
                onChange={(e) => setForm({ ...form, recurrence_interval_days: e.target.value })}
                disabled={!canManage}
              />
            )}

            <div>
              <p className="mb-1.5 text-sm font-medium">Responsáveis</p>
              <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-[var(--color-border)] p-2">
                {profiles.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--color-surface-hover)]">
                    <input
                      type="checkbox"
                      checked={assignees.includes(p.id)}
                      onChange={() => toggleAssignee(p.id)}
                      disabled={!canManage}
                      className="h-4 w-4 accent-[var(--color-primary)]"
                    />
                    <Avatar name={p.full_name} src={p.avatar_url} size="xs" />
                    <span className="truncate text-sm">{p.full_name}</span>
                  </label>
                ))}
                {profiles.length === 0 && (
                  <p className="px-2 py-1 text-xs text-[var(--color-text-muted)]">Nenhum usuário cadastrado.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={removeTask}
        title="Excluir tarefa"
        message="Tem certeza que deseja excluir esta tarefa? Comentários, checklist e anexos também serão removidos."
        confirmLabel="Excluir"
      />
    </>
  );
}
