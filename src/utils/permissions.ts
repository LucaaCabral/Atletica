import type { UserRole } from '@/types';

export type PermissionKey =
  | 'dashboard.view'
  | 'members.view'
  | 'members.manage'
  | 'tasks.view'
  | 'tasks.manage'
  | 'events.view'
  | 'events.manage'
  | 'finance.view'
  | 'finance.manage'
  | 'sports.view'
  | 'sports.manage'
  | 'marketing.view'
  | 'marketing.manage'
  | 'sponsors.view'
  | 'sponsors.manage'
  | 'club.view'
  | 'club.manage'
  | 'documents.view'
  | 'documents.manage'
  | 'calendar.view'
  | 'reports.view'
  | 'settings.manage'
  | 'users.manage'
  | 'audit.view'
  | 'executive.view'
  | 'pending.view';

const ALL: PermissionKey[] = [
  'dashboard.view',
  'members.view',
  'members.manage',
  'tasks.view',
  'tasks.manage',
  'events.view',
  'events.manage',
  'finance.view',
  'finance.manage',
  'sports.view',
  'sports.manage',
  'marketing.view',
  'marketing.manage',
  'sponsors.view',
  'sponsors.manage',
  'club.view',
  'club.manage',
  'documents.view',
  'documents.manage',
  'calendar.view',
  'reports.view',
  'settings.manage',
  'users.manage',
  'audit.view',
  'executive.view',
  'pending.view',
];

// Transparência: todo mundo enxerga quase tudo. As linhas abaixo controlam
// principalmente EDIÇÃO — visualização é liberada para os 4 papéis, exceto
// auditoria (só diretor+) e as áreas administrativas (só presidente/vice).
const BASE_VIEW: PermissionKey[] = [
  'dashboard.view',
  'members.view',
  'tasks.view',
  'events.view',
  'finance.view',
  'sports.view',
  'marketing.view',
  'sponsors.view',
  'club.view',
  'documents.view',
  'calendar.view',
  'reports.view',
  'pending.view',
];

// TODO (fase Setores): tornar as permissões de .manage sensíveis ao setor em
// que o diretor/assessor atua (sector_members), em vez de globais como hoje.
export const rolePermissions: Record<UserRole, PermissionKey[]> = {
  presidente: ALL,
  vice: ALL,
  diretor: [
    ...BASE_VIEW,
    'audit.view',
    'executive.view',
    'members.manage',
    'tasks.manage',
    'events.manage',
    'finance.manage',
    'sports.manage',
    'marketing.manage',
    'sponsors.manage',
    'club.manage',
    'documents.manage',
  ],
  assessor: [...BASE_VIEW, 'tasks.manage'],
};

export function hasPermission(role: UserRole | null | undefined, permission: PermissionKey): boolean {
  if (!role) return false;
  return rolePermissions[role]?.includes(permission) ?? false;
}
