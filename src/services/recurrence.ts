import { addDays, addMonths, addWeeks } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type { Task } from '@/types';

function nextDueDate(task: Task): string | null {
  const base = task.due_date ? new Date(`${task.due_date}T00:00:00`) : new Date();
  switch (task.recurrence_type) {
    case 'daily':
      return addDays(base, 1).toISOString().slice(0, 10);
    case 'weekly':
      return addWeeks(base, 1).toISOString().slice(0, 10);
    case 'monthly':
      return addMonths(base, 1).toISOString().slice(0, 10);
    case 'custom':
      return addDays(base, task.recurrence_interval_days ?? 7).toISOString().slice(0, 10);
    default:
      return null;
  }
}

/**
 * Gera a próxima ocorrência de uma tarefa recorrente ao ser concluída.
 * Não há job agendado: a geração acontece no momento em que o status
 * vira "done" (ver TasksPage/TaskModal/SectorDetailPage).
 */
export async function generateNextOccurrence(task: Task): Promise<{ error: string | null }> {
  if (!task.recurrence_type) return { error: null };
  const due_date = nextDueDate(task);

  const { data: newTask, error } = await supabase
    .from('tasks')
    .insert({
      title: task.title,
      description: task.description,
      sector_id: task.sector_id,
      event_id: task.event_id,
      priority: task.priority,
      status: 'todo',
      due_date,
      labels: task.labels,
      recurrence_type: task.recurrence_type,
      recurrence_interval_days: task.recurrence_interval_days,
    })
    .select('id')
    .single();
  if (error) return { error: error.message };

  const assigneeIds = (task.assignees ?? []).map((a) => a.profile_id);
  if (assigneeIds.length > 0 && newTask) {
    await supabase.from('task_assignees').insert(assigneeIds.map((profile_id) => ({ task_id: newTask.id, profile_id })));
  }
  return { error: null };
}
