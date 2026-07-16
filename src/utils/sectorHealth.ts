import type { FinancialTransaction, SectorGoal, Task } from '@/types';
import { todayISO } from '@/utils/format';

/**
 * Pesos da Saúde do Setor — combinação simples e fácil de ajustar depois
 * que houver dados reais para calibrar (ver plano em .claude/plans).
 */
const WEIGHTS = {
  taskCompletion: 0.35,
  onTime: 0.25,
  goals: 0.25,
  budget: 0.15,
};

export interface SectorHealthInput {
  tasks: Pick<Task, 'status' | 'due_date'>[];
  goals: Pick<SectorGoal, 'status' | 'current_value' | 'target_value'>[];
  transactions?: Pick<FinancialTransaction, 'type' | 'status' | 'amount'>[];
}

export function computeSectorHealth({ tasks, goals, transactions }: SectorHealthInput): number {
  const today = todayISO();

  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const completionScore = tasks.length === 0 ? 100 : (doneCount / tasks.length) * 100;

  const openTasks = tasks.filter((t) => !['done', 'cancelled'].includes(t.status));
  const overdueCount = openTasks.filter((t) => t.due_date && t.due_date < today).length;
  const onTimeScore = openTasks.length === 0 ? 100 : Math.max(0, 100 - (overdueCount / openTasks.length) * 100);

  const goalScore =
    goals.length === 0
      ? 100
      : goals.reduce((sum, g) => {
          if (g.status === 'achieved') return sum + 100;
          if (g.status === 'missed') return sum + 0;
          if (g.target_value && g.target_value > 0) return sum + Math.min(100, (g.current_value / g.target_value) * 100);
          return sum + 50;
        }, 0) / goals.length;

  let budgetScore = 100;
  if (transactions && transactions.length > 0) {
    const paid = transactions.filter((t) => t.status === 'paid');
    const income = paid.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expense = paid.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    budgetScore = income >= expense ? 100 : Math.max(0, 100 - ((expense - income) / Math.max(income, 1)) * 100);
  }

  const score =
    completionScore * WEIGHTS.taskCompletion +
    onTimeScore * WEIGHTS.onTime +
    goalScore * WEIGHTS.goals +
    budgetScore * WEIGHTS.budget;

  return Math.round(Math.min(100, Math.max(0, score)));
}

export function healthTone(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 80) return 'success';
  if (score >= 60) return 'warning';
  return 'danger';
}
