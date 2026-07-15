-- ============================================================
-- GESTÃO ATLÉTICA — Schema completo do Supabase
-- Execute este arquivo no SQL Editor do Supabase (uma única vez).
-- Ordem: extensões > enums > tabelas > funções > triggers > RLS > storage.
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

create type public.user_role as enum (
  'admin', 'director', 'member', 'treasury', 'marketing', 'sports', 'coach', 'viewer'
);

create type public.task_status as enum (
  'backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'
);

create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');

create type public.event_status as enum (
  'planning', 'preparing', 'confirmed', 'ongoing', 'finished', 'cancelled'
);

create type public.transaction_type as enum ('income', 'expense');

create type public.transaction_status as enum (
  'pending', 'paid', 'overdue', 'cancelled', 'partial'
);

create type public.marketing_status as enum (
  'received', 'in_analysis', 'in_production', 'awaiting_approval',
  'changes_requested', 'approved', 'scheduled', 'published', 'cancelled'
);

create type public.sponsor_status as enum (
  'prospecting', 'contacted', 'meeting_scheduled', 'proposal_sent',
  'negotiating', 'closed', 'lost', 'ended', 'renewal'
);

create type public.club_status as enum ('active', 'pending', 'expired', 'cancelled');

create type public.attendance_status as enum ('present', 'absent', 'justified');

create type public.calendar_category as enum (
  'event', 'meeting', 'game', 'training', 'deadline', 'publication', 'payment', 'task', 'other'
);

-- ============================================================
-- TABELAS
-- ============================================================

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  responsible_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.positions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  access_level int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null,
  nickname text,
  phone text,
  avatar_url text,
  role public.user_role not null default 'member',
  department_id uuid references public.departments (id) on delete set null,
  position_title text,
  theme_preference text not null default 'system' check (theme_preference in ('light', 'dark', 'system')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.departments
  add constraint departments_responsible_fk
  foreign key (responsible_id) references public.profiles (id) on delete set null;

create table public.authorized_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role public.user_role not null default 'member',
  department_id uuid references public.departments (id) on delete set null,
  invited_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Tabelas auxiliares de papéis/permissões (documentação e extensão futura;
-- a aplicação usa profiles.role como fonte primária).
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  primary key (user_id, role_id)
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  full_name text not null,
  nickname text,
  email text,
  phone text,
  photo_url text,
  position_id uuid references public.positions (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,
  joined_at date,
  left_at date,
  status text not null default 'active' check (status in ('active', 'inactive')),
  bio text,
  responsibilities text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cover_url text,
  description text,
  category text,
  status public.event_status not null default 'planning',
  start_date date,
  end_date date,
  location text,
  address text,
  expected_attendance int,
  actual_attendance int,
  budget numeric(12, 2),
  responsible_id uuid references public.profiles (id) on delete set null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_members (
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role_in_event text,
  created_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);

create table public.event_timeline (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  title text not null,
  description text,
  date date not null,
  is_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  department_id uuid references public.departments (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  priority public.task_priority not null default 'medium',
  status public.task_status not null default 'todo',
  start_date date,
  due_date date,
  labels text[] not null default '{}',
  is_archived boolean not null default false,
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.task_assignees (
  task_id uuid not null references public.tasks (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, profile_id)
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.task_checklists (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.transaction_type not null,
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  email text,
  document text,
  category text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  type public.transaction_type not null,
  description text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  category_id uuid references public.financial_categories (id) on delete set null,
  date date not null default current_date,
  due_date date,
  paid_at date,
  status public.transaction_status not null default 'pending',
  payment_method text,
  event_id uuid references public.events (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,
  supplier_id uuid references public.suppliers (id) on delete set null,
  responsible_id uuid references public.profiles (id) on delete set null,
  recurrence text,
  notes text,
  receipt_path text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sports (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  gender text,
  responsible_id uuid references public.profiles (id) on delete set null,
  coach_name text,
  training_location text,
  schedule text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coaches (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  name text not null,
  phone text,
  email text,
  sport_id uuid references public.sports (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sport_id uuid not null references public.sports (id) on delete cascade,
  coach_id uuid references public.coaches (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.athletes (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  photo_url text,
  registration text,
  course text,
  semester text,
  phone text,
  email text,
  sport_id uuid references public.sports (id) on delete set null,
  team_id uuid references public.teams (id) on delete set null,
  position text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Contato de emergência em tabela separada: RLS é por linha, e este dado
-- só pode ser lido por admin, esportes e treinadores.
create table public.athlete_emergency_contacts (
  athlete_id uuid primary key references public.athletes (id) on delete cascade,
  contact_name text not null,
  contact_phone text not null,
  relationship text,
  updated_at timestamptz not null default now()
);

create table public.team_athletes (
  team_id uuid not null references public.teams (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  primary key (team_id, athlete_id)
);

create table public.trainings (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  date timestamptz not null,
  location text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.training_attendance (
  training_id uuid not null references public.trainings (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  status public.attendance_status not null default 'present',
  note text,
  created_at timestamptz not null default now(),
  primary key (training_id, athlete_id)
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  opponent text,
  date timestamptz not null,
  location text,
  our_score int,
  opponent_score int,
  result text check (result in ('win', 'loss', 'draw')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  logo_url text,
  contact_name text,
  phone text,
  email text,
  website text,
  segment text,
  status public.sponsor_status not null default 'prospecting',
  value numeric(12, 2),
  partnership_type text,
  start_date date,
  end_date date,
  deliverables text,
  counterparts text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sponsorships (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  value numeric(12, 2),
  notes text,
  created_at timestamptz not null default now()
);

create table public.marketing_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  requester_id uuid references public.profiles (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  description text,
  briefing text,
  format text,
  channel text,
  due_date date,
  publish_date date,
  priority public.task_priority not null default 'medium',
  assignee_id uuid references public.profiles (id) on delete set null,
  status public.marketing_status not null default 'received',
  final_file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketing_approvals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.marketing_requests (id) on delete cascade,
  approver_id uuid references public.profiles (id) on delete set null,
  decision text not null check (decision in ('approved', 'changes_requested')),
  comment text,
  created_at timestamptz not null default now()
);

create table public.marketing_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.marketing_requests (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.marketing_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.marketing_requests (id) on delete cascade,
  file_name text not null,
  file_path text not null,
  kind text not null default 'reference' check (kind in ('reference', 'version', 'final')),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.members_club (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  photo_url text,
  registration text,
  course text,
  email text,
  phone text,
  card_number text,
  plan_name text,
  start_date date,
  valid_until date,
  status public.club_status not null default 'pending',
  payment_note text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.membership_payments (
  id uuid primary key default gen_random_uuid(),
  member_club_id uuid not null references public.members_club (id) on delete cascade,
  amount numeric(12, 2) not null,
  paid_at date not null default current_date,
  method text,
  reference text,
  created_at timestamptz not null default now()
);

create table public.benefits (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  partner_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null default 'Outros',
  folder text,
  file_path text not null,
  file_size bigint,
  mime_type text,
  version int not null default 1,
  uploaded_by uuid references public.profiles (id) on delete set null,
  related_type text,
  related_id uuid,
  access_level text not null default 'all' check (access_level in ('all', 'directors', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.calendar_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category public.calendar_category not null default 'other',
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  department_id uuid references public.departments (id) on delete set null,
  responsible_id uuid references public.profiles (id) on delete set null,
  related_type text,
  related_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  category text not null default 'general',
  related_type text,
  related_id uuid,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  module text not null,
  entity_type text,
  entity_id uuid,
  summary text,
  created_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

create index idx_profiles_department on public.profiles (department_id);
create index idx_members_department on public.members (department_id);
create index idx_members_status on public.members (status);
create index idx_tasks_status on public.tasks (status);
create index idx_tasks_due_date on public.tasks (due_date);
create index idx_tasks_department on public.tasks (department_id);
create index idx_tasks_event on public.tasks (event_id);
create index idx_task_assignees_profile on public.task_assignees (profile_id);
create index idx_task_comments_task on public.task_comments (task_id);
create index idx_events_status on public.events (status);
create index idx_events_start_date on public.events (start_date);
create index idx_transactions_date on public.financial_transactions (date);
create index idx_transactions_status on public.financial_transactions (status);
create index idx_transactions_event on public.financial_transactions (event_id);
create index idx_athletes_sport on public.athletes (sport_id);
create index idx_trainings_sport on public.trainings (sport_id);
create index idx_attendance_athlete on public.training_attendance (athlete_id);
create index idx_marketing_status on public.marketing_requests (status);
create index idx_sponsors_status on public.sponsors (status);
create index idx_club_status on public.members_club (status);
create index idx_documents_category on public.documents (category);
create index idx_calendar_start on public.calendar_entries (start_at);
create index idx_notifications_user on public.notifications (user_id, is_read);
create index idx_activity_logs_created on public.activity_logs (created_at desc);

-- ============================================================
-- FUNÇÕES AUXILIARES
-- ============================================================

create or replace function public.my_role()
returns text
language sql stable security definer set search_path = public
as $$
  select role::text from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.my_role() = 'admin', false);
$$;

create or replace function public.has_finance_access()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.my_role() in ('admin', 'treasury'), false);
$$;

create or replace function public.can_write()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.my_role() is not null and public.my_role() <> 'viewer', false);
$$;

create or replace function public.is_director_or_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.my_role() in ('admin', 'director'), false);
$$;

create or replace function public.can_view_emergency_contacts()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.my_role() in ('admin', 'sports', 'coach'), false);
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'updated_at'
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t
    );
  end loop;
end $$;

-- Criação de perfil no signup: só permite e-mails convidados.
-- O primeiro usuário do sistema vira administrador automaticamente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  invite record;
  profile_count int;
begin
  select count(*) into profile_count from public.profiles;

  select * into invite
  from public.authorized_emails
  where lower(email) = lower(new.email) and used_at is null
  limit 1;

  if profile_count = 0 then
    insert into public.profiles (id, email, full_name, role)
    values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), 'admin');
  elsif invite.id is not null then
    insert into public.profiles (id, email, full_name, role, department_id)
    values (
      new.id, new.email,
      coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
      invite.role, invite.department_id
    );
    update public.authorized_emails set used_at = now() where id = invite.id;
  else
    raise exception 'Cadastro permitido apenas por convite. Solicite acesso a um administrador.';
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Notificação quando alguém é atribuído a uma tarefa.
create or replace function public.notify_task_assignment()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  task_title text;
begin
  select title into task_title from public.tasks where id = new.task_id;
  if new.profile_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
    insert into public.notifications (user_id, title, body, category, related_type, related_id, link)
    values (
      new.profile_id,
      'Nova tarefa atribuída',
      coalesce(task_title, 'Uma tarefa foi atribuída a você.'),
      'task', 'task', new.task_id, '/tarefas?task=' || new.task_id
    );
  end if;
  return new;
end;
$$;

create trigger on_task_assigned
  after insert on public.task_assignees
  for each row execute function public.notify_task_assignment();

-- Notificação para os responsáveis quando há novo comentário na tarefa.
create or replace function public.notify_task_comment()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  task_title text;
begin
  select title into task_title from public.tasks where id = new.task_id;
  insert into public.notifications (user_id, title, body, category, related_type, related_id, link)
  select ta.profile_id,
         'Novo comentário em tarefa',
         coalesce(task_title, 'Tarefa') || ': ' || left(new.content, 120),
         'task', 'task', new.task_id, '/tarefas?task=' || new.task_id
  from public.task_assignees ta
  where ta.task_id = new.task_id
    and ta.profile_id <> coalesce(new.author_id, '00000000-0000-0000-0000-000000000000'::uuid);
  return new;
end;
$$;

create trigger on_task_comment
  after insert on public.task_comments
  for each row execute function public.notify_task_comment();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

do $$
declare
  t text;
begin
  for t in
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- profiles ----------
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_own_or_admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy "profiles_delete_admin" on public.profiles
  for delete to authenticated using (public.is_admin());

-- ---------- authorized_emails (somente admin) ----------
create policy "invites_admin_all" on public.authorized_emails
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- roles / permissions (leitura geral, escrita admin) ----------
create policy "roles_select" on public.roles for select to authenticated using (true);
create policy "roles_admin_write" on public.roles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "permissions_select" on public.permissions for select to authenticated using (true);
create policy "permissions_admin_write" on public.permissions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "role_permissions_select" on public.role_permissions for select to authenticated using (true);
create policy "role_permissions_admin_write" on public.role_permissions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "user_roles_select" on public.user_roles for select to authenticated using (true);
create policy "user_roles_admin_write" on public.user_roles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- tabelas operacionais: leitura autenticada, escrita para não-viewers,
-- ---------- exclusão para admin/diretor ou autor ----------
do $$
declare
  t text;
begin
  foreach t in array array[
    'departments', 'positions', 'members', 'events', 'event_members', 'event_timeline',
    'tasks', 'task_assignees', 'task_comments', 'task_checklists', 'task_attachments',
    'sports', 'coaches', 'teams', 'athletes', 'team_athletes', 'trainings',
    'training_attendance', 'games', 'sponsors', 'sponsorships',
    'marketing_requests', 'marketing_approvals', 'marketing_comments', 'marketing_files',
    'members_club', 'benefits', 'documents', 'calendar_entries'
  ]
  loop
    execute format(
      'create policy "%s_select" on public.%I for select to authenticated using (true)', t, t
    );
    execute format(
      'create policy "%s_insert" on public.%I for insert to authenticated with check (public.can_write())', t, t
    );
    execute format(
      'create policy "%s_update" on public.%I for update to authenticated
       using (public.can_write()) with check (public.can_write())', t, t
    );
    execute format(
      'create policy "%s_delete" on public.%I for delete to authenticated
       using (public.is_director_or_admin() or public.my_role() in (''treasury'', ''marketing'', ''sports''))', t, t
    );
  end loop;
end $$;

-- ---------- financeiro (restrito a admin + tesouraria) ----------
create policy "fin_categories_select" on public.financial_categories
  for select to authenticated using (true);
create policy "fin_categories_write" on public.financial_categories
  for all to authenticated using (public.has_finance_access()) with check (public.has_finance_access());

create policy "suppliers_finance_all" on public.suppliers
  for all to authenticated using (public.has_finance_access()) with check (public.has_finance_access());
create policy "suppliers_select_staff" on public.suppliers
  for select to authenticated using (public.can_write());

create policy "transactions_finance_all" on public.financial_transactions
  for all to authenticated using (public.has_finance_access()) with check (public.has_finance_access());

create policy "membership_payments_select" on public.membership_payments
  for select to authenticated using (public.has_finance_access() or public.is_director_or_admin());
create policy "membership_payments_write" on public.membership_payments
  for insert to authenticated with check (public.has_finance_access());
create policy "membership_payments_update" on public.membership_payments
  for update to authenticated using (public.has_finance_access()) with check (public.has_finance_access());
create policy "membership_payments_delete" on public.membership_payments
  for delete to authenticated using (public.has_finance_access());

-- ---------- contato de emergência (dados sensíveis) ----------
create policy "emergency_select" on public.athlete_emergency_contacts
  for select to authenticated using (public.can_view_emergency_contacts());
create policy "emergency_write" on public.athlete_emergency_contacts
  for all to authenticated
  using (public.can_view_emergency_contacts())
  with check (public.can_view_emergency_contacts());

-- ---------- notificações (cada usuário vê apenas as suas) ----------
create policy "notifications_select_own" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifications_insert" on public.notifications
  for insert to authenticated with check (public.can_write());
create policy "notifications_update_own" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_delete_own" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- ---------- auditoria ----------
create policy "logs_select" on public.activity_logs
  for select to authenticated using (public.is_director_or_admin());
create policy "logs_insert_own" on public.activity_logs
  for insert to authenticated with check (user_id = auth.uid());

-- ---------- configurações ----------
create policy "settings_select" on public.app_settings
  for select to authenticated using (true);
create policy "settings_admin_write" on public.app_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- STORAGE — buckets e políticas
-- ============================================================

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('branding', 'branding', true),
  ('task-attachments', 'task-attachments', false),
  ('event-files', 'event-files', false),
  ('financial-receipts', 'financial-receipts', false),
  ('marketing-files', 'marketing-files', false),
  ('sponsor-files', 'sponsor-files', false),
  ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "storage_public_read" on storage.objects
  for select using (bucket_id in ('avatars', 'branding'));

create policy "storage_auth_read" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('task-attachments', 'event-files', 'marketing-files', 'sponsor-files', 'documents')
    or (bucket_id = 'financial-receipts' and public.has_finance_access())
  );

create policy "storage_auth_insert" on storage.objects
  for insert to authenticated
  with check (
    (bucket_id in ('avatars', 'branding', 'task-attachments', 'event-files', 'marketing-files', 'sponsor-files', 'documents')
      and public.can_write())
    or (bucket_id = 'financial-receipts' and public.has_finance_access())
  );

create policy "storage_auth_update" on storage.objects
  for update to authenticated
  using (owner = auth.uid() or public.is_admin());

create policy "storage_auth_delete" on storage.objects
  for delete to authenticated
  using (owner = auth.uid() or public.is_director_or_admin() or (bucket_id = 'financial-receipts' and public.has_finance_access()));
