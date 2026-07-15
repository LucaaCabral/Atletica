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
  | 'audit.view';

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
];

const BASE_VIEW: PermissionKey[] = [
  'dashboard.view',
  'members.view',
  'tasks.view',
  'events.view',
  'documents.view',
  'calendar.view',
];

export const rolePermissions: Record<UserRole, PermissionKey[]> = {
  admin: ALL,
  director: [
    ...BASE_VIEW,
    'members.manage',
    'tasks.manage',
    'events.manage',
    'sports.view',
    'marketing.view',
    'sponsors.view',
    'sponsors.manage',
    'club.view',
    'documents.manage',
    'reports.view',
    'audit.view',
  ],
  member: [...BASE_VIEW, 'tasks.manage', 'marketing.view'],
  treasury: [
    ...BASE_VIEW,
    'tasks.manage',
    'finance.view',
    'finance.manage',
    'club.view',
    'club.manage',
    'sponsors.view',
    'reports.view',
    'documents.manage',
  ],
  marketing: [
    ...BASE_VIEW,
    'tasks.manage',
    'marketing.view',
    'marketing.manage',
    'sponsors.view',
    'documents.manage',
    'reports.view',
  ],
  sports: [
    ...BASE_VIEW,
    'tasks.manage',
    'sports.view',
    'sports.manage',
    'documents.manage',
    'reports.view',
  ],
  coach: ['dashboard.view', 'calendar.view', 'sports.view', 'sports.manage', 'tasks.view'],
  viewer: BASE_VIEW,
};

export function hasPermission(role: UserRole | null | undefined, permission: PermissionKey): boolean {
  if (!role) return false;
  return rolePermissions[role]?.includes(permission) ?? false;
}
