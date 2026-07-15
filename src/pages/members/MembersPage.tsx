import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, List, Pencil, Plus, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useQuery } from '@/hooks/useQuery';
import { useDebounce } from '@/hooks/useDebounce';
import { logActivity } from '@/services/activityLog';
import type { Department, Member, Position } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Input, Select, SearchInput, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/State';
import { formatDate } from '@/utils/format';

interface MemberForm {
  full_name: string;
  nickname: string;
  email: string;
  phone: string;
  department_id: string;
  position_id: string;
  joined_at: string;
  status: 'active' | 'inactive';
  bio: string;
  responsibilities: string;
  notes: string;
}

const emptyForm: MemberForm = {
  full_name: '',
  nickname: '',
  email: '',
  phone: '',
  department_id: '',
  position_id: '',
  joined_at: '',
  status: 'active',
  bio: '',
  responsibilities: '',
  notes: '',
};

export function MembersPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const canManage = can('members.manage');

  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState<MemberForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const debouncedSearch = useDebounce(search);

  const departments = useQuery<Department[]>(async () => {
    const { data, error } = await supabase.from('departments').select('*').order('name');
    if (error) throw new Error(error.message);
    return (data ?? []) as Department[];
  });

  const positions = useQuery<Position[]>(async () => {
    const { data, error } = await supabase.from('positions').select('*').order('access_level', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Position[];
  });

  const members = useQuery<Member[]>(async () => {
    let query = supabase
      .from('members')
      .select('*, department:departments(*), position:positions(*)')
      .order('full_name');
    if (debouncedSearch) query = query.ilike('full_name', `%${debouncedSearch}%`);
    if (departmentFilter) query = query.eq('department_id', departmentFilter);
    if (statusFilter) query = query.eq('status', statusFilter);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as Member[];
  }, [debouncedSearch, departmentFilter, statusFilter]);

  const departmentOptions = useMemo(
    () => (departments.data ?? []).map((d) => ({ value: d.id, label: d.name })),
    [departments.data],
  );
  const positionOptions = useMemo(
    () => (positions.data ?? []).map((p) => ({ value: p.id, label: p.name })),
    [positions.data],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (member: Member) => {
    setEditing(member);
    setForm({
      full_name: member.full_name,
      nickname: member.nickname ?? '',
      email: member.email ?? '',
      phone: member.phone ?? '',
      department_id: member.department_id ?? '',
      position_id: member.position_id ?? '',
      joined_at: member.joined_at ?? '',
      status: member.status,
      bio: member.bio ?? '',
      responsibilities: member.responsibilities ?? '',
      notes: member.notes ?? '',
    });
    setModalOpen(true);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (form.full_name.trim().length < 3) {
      toast.error('Informe o nome completo do membro.');
      return;
    }
    setSaving(true);
    const payload = {
      full_name: form.full_name.trim(),
      nickname: form.nickname.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      department_id: form.department_id || null,
      position_id: form.position_id || null,
      joined_at: form.joined_at || null,
      status: form.status,
      bio: form.bio.trim() || null,
      responsibilities: form.responsibilities.trim() || null,
      notes: form.notes.trim() || null,
    };

    const result = editing
      ? await supabase.from('members').update(payload).eq('id', editing.id)
      : await supabase.from('members').insert(payload);

    setSaving(false);
    if (result.error) {
      toast.error(`Erro ao salvar: ${result.error.message}`);
      return;
    }
    toast.success(editing ? 'Membro atualizado.' : 'Membro cadastrado.');
    void logActivity({
      action: editing ? 'update' : 'create',
      module: 'diretoria',
      entityType: 'member',
      summary: `${editing ? 'Atualizou' : 'Cadastrou'} o membro ${payload.full_name}`,
    });
    setModalOpen(false);
    void members.refetch();
  };

  const columns: Column<Member>[] = [
    {
      key: 'name',
      header: 'Nome',
      render: (m) => (
        <span className="flex items-center gap-2">
          <Avatar name={m.full_name} src={m.photo_url} size="sm" />
          <span>
            <span className="block font-medium">{m.full_name}</span>
            {m.nickname && <span className="text-xs text-[var(--color-text-muted)]">“{m.nickname}”</span>}
          </span>
        </span>
      ),
    },
    { key: 'department', header: 'Diretoria', render: (m) => m.department?.name ?? '—', hideOnMobile: true },
    { key: 'position', header: 'Cargo', render: (m) => m.position?.name ?? '—', hideOnMobile: true },
    { key: 'joined', header: 'Entrada', render: (m) => formatDate(m.joined_at), hideOnMobile: true },
    {
      key: 'status',
      header: 'Status',
      render: (m) => (
        <Badge tone={m.status === 'active' ? 'success' : 'neutral'}>
          {m.status === 'active' ? 'Ativo' : 'Inativo'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (m) =>
        canManage ? (
          <span onClick={(e) => e.stopPropagation()}>
            <IconButton label={`Editar ${m.full_name}`} size="sm" onClick={() => openEdit(m)}>
              <Pencil size={15} />
            </IconButton>
          </span>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Diretoria"
        description="Gestão dos membros da Atlética."
        breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Diretoria' }]}
        actions={
          <>
            <div className="flex rounded-lg border border-[var(--color-border)] p-0.5">
              <IconButton
                label="Visualizar em cards"
                size="sm"
                variant={view === 'cards' ? 'secondary' : 'ghost'}
                onClick={() => setView('cards')}
              >
                <LayoutGrid size={16} />
              </IconButton>
              <IconButton
                label="Visualizar em tabela"
                size="sm"
                variant={view === 'table' ? 'secondary' : 'ghost'}
                onClick={() => setView('table')}
              >
                <List size={16} />
              </IconButton>
            </div>
            {canManage && (
              <Button icon={<Plus size={16} />} onClick={openCreate}>
                Novo membro
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput
          placeholder="Buscar por nome…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar membro"
          containerClassName="flex-1"
        />
        <Select
          aria-label="Filtrar por diretoria"
          options={departmentOptions}
          placeholder="Todas as diretorias"
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="sm:w-52"
        />
        <Select
          aria-label="Filtrar por status"
          options={[
            { value: 'active', label: 'Ativos' },
            { value: 'inactive', label: 'Inativos' },
          ]}
          placeholder="Todos os status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="sm:w-44"
        />
      </div>

      {members.error ? (
        <ErrorState message={members.error} onRetry={() => void members.refetch()} />
      ) : view === 'cards' ? (
        members.loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (members.data ?? []).length === 0 ? (
          <EmptyState
            icon={<Users size={24} />}
            title="Nenhum membro encontrado"
            description="Cadastre o primeiro membro da diretoria para começar."
            actionLabel={canManage ? 'Cadastrar membro' : undefined}
            onAction={canManage ? openCreate : undefined}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(members.data ?? []).map((m) => (
              <Card
                key={m.id}
                className="cursor-pointer p-4 transition-colors hover:border-[var(--color-primary)]"
                onClick={() => navigate(`/diretoria/${m.id}`)}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={m.full_name} src={m.photo_url} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{m.full_name}</p>
                    <p className="truncate text-sm text-[var(--color-text-secondary)]">
                      {m.position?.name ?? 'Sem cargo'} · {m.department?.name ?? 'Sem diretoria'}
                    </p>
                    {m.email && <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">{m.email}</p>}
                  </div>
                  <span className="flex flex-col items-end gap-1">
                    <Badge tone={m.status === 'active' ? 'success' : 'neutral'}>
                      {m.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                    {canManage && (
                      <span onClick={(e) => e.stopPropagation()}>
                        <IconButton label={`Editar ${m.full_name}`} size="sm" onClick={() => openEdit(m)}>
                          <Pencil size={14} />
                        </IconButton>
                      </span>
                    )}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card>
          <DataTable
            columns={columns}
            rows={members.data ?? []}
            rowKey={(m) => m.id}
            loading={members.loading}
            onRowClick={(m) => navigate(`/diretoria/${m.id}`)}
            emptyState={
              <EmptyState
                icon={<Users size={24} />}
                title="Nenhum membro encontrado"
                description="Ajuste os filtros ou cadastre um novo membro."
              />
            }
          />
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar membro' : 'Novo membro'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={(e) => void onSubmit(e as unknown as FormEvent)}>
              {editing ? 'Salvar alterações' : 'Cadastrar'}
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nome completo"
            required
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
          <Input
            label="Apelido / nome social"
            value={form.nickname}
            onChange={(e) => setForm({ ...form, nickname: e.target.value })}
          />
          <Input
            label="E-mail"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Telefone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Select
            label="Diretoria"
            options={departmentOptions}
            placeholder="Selecione…"
            value={form.department_id}
            onChange={(e) => setForm({ ...form, department_id: e.target.value })}
          />
          <Select
            label="Cargo"
            options={positionOptions}
            placeholder="Selecione…"
            value={form.position_id}
            onChange={(e) => setForm({ ...form, position_id: e.target.value })}
          />
          <Input
            label="Data de entrada"
            type="date"
            value={form.joined_at}
            onChange={(e) => setForm({ ...form, joined_at: e.target.value })}
          />
          <Select
            label="Status"
            options={[
              { value: 'active', label: 'Ativo' },
              { value: 'inactive', label: 'Inativo' },
            ]}
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}
          />
          <div className="sm:col-span-2">
            <Textarea
              label="Descrição / bio"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              label="Responsabilidades"
              value={form.responsibilities}
              onChange={(e) => setForm({ ...form, responsibilities: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              label="Observações"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
