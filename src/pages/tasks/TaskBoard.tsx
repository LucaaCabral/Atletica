import { useState } from 'react';
import type { DragEvent } from 'react';
import { CalendarClock, Paperclip } from 'lucide-react';
import type { Task, TaskStatus } from '@/types';
import { Badge, priorityTones } from '@/components/ui/Badge';
import { AvatarGroup } from '@/components/ui/Avatar';
import { taskPriorityLabels, taskStatusLabels, taskStatusOrder } from '@/utils/labels';
import { formatDate, isOverdue } from '@/utils/format';
import { cn } from '@/utils/cn';

interface TaskBoardProps {
  tasks: Task[];
  onMoveTask: (taskId: string, status: TaskStatus) => void;
  onOpenTask: (task: Task) => void;
  canManage: boolean;
}

export function TaskBoard({ tasks, onMoveTask, onOpenTask, canManage }: TaskBoardProps) {
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

  const onDragStart = (e: DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/task-id', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = (e: DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOver(null);
    const taskId = e.dataTransfer.getData('text/task-id');
    if (taskId) onMoveTask(taskId, status);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {taskStatusOrder.map((status) => {
        const columnTasks = tasks.filter((t) => t.status === status);
        return (
          <div
            key={status}
            onDragOver={(e) => {
              if (!canManage) return;
              e.preventDefault();
              setDragOver(status);
            }}
            onDragLeave={() => setDragOver((s) => (s === status ? null : s))}
            onDrop={(e) => canManage && onDrop(e, status)}
            className={cn(
              'flex w-64 shrink-0 flex-col rounded-xl border bg-[var(--color-surface-secondary)] transition-colors sm:w-72',
              dragOver === status ? 'border-[var(--color-primary)]' : 'border-transparent',
            )}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                {taskStatusLabels[status]}
              </h3>
              <span className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-xs font-medium">
                {columnTasks.length}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2" style={{ maxHeight: '65dvh' }}>
              {columnTasks.map((task) => {
                const overdue = isOverdue(task.due_date) && !['done', 'cancelled'].includes(task.status);
                return (
                  <button
                    key={task.id}
                    draggable={canManage}
                    onDragStart={(e) => onDragStart(e, task.id)}
                    onClick={() => onOpenTask(task)}
                    className={cn(
                      'rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left',
                      'shadow-[var(--shadow-card)] transition-colors hover:border-[var(--color-primary)]',
                      canManage && 'cursor-grab active:cursor-grabbing',
                    )}
                  >
                    <p className="text-sm font-medium leading-snug">{task.title}</p>
                    {task.labels.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {task.labels.map((label) => (
                          <span
                            key={label}
                            className="rounded-full bg-[var(--color-surface-secondary)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)]"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <Badge tone={priorityTones[task.priority]}>{taskPriorityLabels[task.priority]}</Badge>
                        {task.due_date && (
                          <span
                            className={cn(
                              'flex items-center gap-1 text-[11px]',
                              overdue ? 'font-semibold text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]',
                            )}
                          >
                            <CalendarClock size={11} aria-hidden />
                            {formatDate(task.due_date, 'dd/MM')}
                          </span>
                        )}
                      </div>
                      {(task.assignees ?? []).length > 0 && (
                        <AvatarGroup
                          size="xs"
                          people={(task.assignees ?? []).map((a) => ({
                            name: a.profile?.full_name ?? '?',
                            src: a.profile?.avatar_url,
                          }))}
                          max={3}
                        />
                      )}
                    </div>
                    {task.event?.name && (
                      <p className="mt-1.5 flex items-center gap-1 truncate text-[11px] text-[var(--color-text-muted)]">
                        <Paperclip size={10} aria-hidden />
                        {task.event.name}
                      </p>
                    )}
                  </button>
                );
              })}
              {columnTasks.length === 0 && (
                <p className="px-2 py-4 text-center text-xs text-[var(--color-text-muted)]">Sem tarefas</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
