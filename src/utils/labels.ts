import type {
  ClubStatus,
  EventStatus,
  MarketingStatus,
  SponsorStatus,
  TaskPriority,
  TaskStatus,
  TransactionStatus,
  UserRole,
  CalendarCategory,
} from '@/types';

export const roleLabels: Record<UserRole, string> = {
  admin: 'Administrador',
  director: 'Diretor',
  member: 'Membro',
  treasury: 'Tesouraria',
  marketing: 'Marketing',
  sports: 'Esportes',
  coach: 'Treinador',
  viewer: 'Visualizador',
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'A fazer',
  in_progress: 'Em andamento',
  in_review: 'Em aprovação',
  done: 'Concluído',
  cancelled: 'Cancelado',
};

export const taskStatusOrder: TaskStatus[] = [
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'done',
  'cancelled',
];

export const taskPriorityLabels: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

export const eventStatusLabels: Record<EventStatus, string> = {
  planning: 'Planejamento',
  preparing: 'Em preparação',
  confirmed: 'Confirmado',
  ongoing: 'Em andamento',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
};

export const transactionStatusLabels: Record<TransactionStatus, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Atrasado',
  cancelled: 'Cancelado',
  partial: 'Parcial',
};

export const marketingStatusLabels: Record<MarketingStatus, string> = {
  received: 'Solicitação recebida',
  in_analysis: 'Em análise',
  in_production: 'Em produção',
  awaiting_approval: 'Aguardando aprovação',
  changes_requested: 'Ajustes solicitados',
  approved: 'Aprovado',
  scheduled: 'Agendado',
  published: 'Publicado',
  cancelled: 'Cancelado',
};

export const marketingStatusOrder: MarketingStatus[] = [
  'received',
  'in_analysis',
  'in_production',
  'awaiting_approval',
  'changes_requested',
  'approved',
  'scheduled',
  'published',
  'cancelled',
];

export const sponsorStatusLabels: Record<SponsorStatus, string> = {
  prospecting: 'Prospecção',
  contacted: 'Contato realizado',
  meeting_scheduled: 'Reunião marcada',
  proposal_sent: 'Proposta enviada',
  negotiating: 'Negociação',
  closed: 'Fechado',
  lost: 'Perdido',
  ended: 'Encerrado',
  renewal: 'Renovação',
};

export const sponsorStatusOrder: SponsorStatus[] = [
  'prospecting',
  'contacted',
  'meeting_scheduled',
  'proposal_sent',
  'negotiating',
  'closed',
  'renewal',
  'ended',
  'lost',
];

export const clubStatusLabels: Record<ClubStatus, string> = {
  active: 'Ativo',
  pending: 'Pendente',
  expired: 'Vencido',
  cancelled: 'Cancelado',
};

export const calendarCategoryLabels: Record<CalendarCategory, string> = {
  event: 'Evento',
  meeting: 'Reunião',
  game: 'Jogo',
  training: 'Treino',
  deadline: 'Prazo',
  publication: 'Publicação',
  payment: 'Vencimento',
  task: 'Tarefa',
  other: 'Outro',
};

export const calendarCategoryColors: Record<CalendarCategory, string> = {
  event: 'var(--color-primary)',
  meeting: 'var(--color-info)',
  game: 'var(--color-secondary)',
  training: 'var(--color-success)',
  deadline: 'var(--color-danger)',
  publication: '#9333ea',
  payment: 'var(--color-warning)',
  task: 'var(--color-text-secondary)',
  other: 'var(--color-text-muted)',
};
