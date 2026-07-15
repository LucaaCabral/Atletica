import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Save, Mail, ShieldCheck, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useQuery } from '@/hooks/useQuery';
import { logActivity } from '@/services/activityLog';
import type {
  ActivityLog,
  AuthorizedEmail,
  Department,
  Position,
  Profile,
  TaskLabelDef,
  ThemePreference,
  UserRole,
} from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Input, Select, Switch, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/State';
import { roleLabels } from '@/utils/labels';
import { formatDateTime, formatRelative } from '@/utils/format';

const roleOptions = (Object.keys(roleLabels) as UserRole[]).map((r) => ({ value: r, label: roleLabels[r] }));

export function SettingsPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const settings = useSettings();

  const [tab, setTab] = useState('general');
  const [saving, setSaving] = useState(false);

  const [generalForm, setGeneralForm] = useState(settings.general);
  const [brandingForm, setBrandingForm] = useState(settings.branding);
  const [clubForm, setClubForm] = useState(settings.club);
  const [docCats, setDocCats] = useState<string[]>(settings.docCategories);
  const [eventCats, setEventCats] = useState<string[]>(settings.eventCategories);
  const [labels, setLabels] = useState<TaskLabelDef[]>(settings.taskLabels);
  const [newDocCat, setNewDocCat] = useState('');
  const [newEventCat, setNewEventCat] = useState('');
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => setGeneralForm(settings.general), [settings.general]);
  useEffect(() => setBrandingForm(settings.branding), [settings.branding]);
  useEffect(() => setClubForm(settings.club), [settings.club]);
  useEffect(() => setDocCats(settings.docCategories), [settings.docCategories]);
  useEffect(() => setEventCats(settings.eventCategories), [settings.eventCategories]);
  useEffect(() => setLabels(settings.taskLabels), [settings.taskLabels]);

  const [deptModal, setDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptForm, setDeptForm] = useState({ name: '', description: '', responsible_id: '', is_active: true });

  const [posModal, setPosModal] = useState(false);
  const [editingPos, setEditingPos] = useState<Position | null>(null);
  const [posForm, setPosForm] = useState({ name: '', description: '', access_level: '1' });

  const [inviteModal, setInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'member' as UserRole, department_id: '' });
  const [deletingInvite, setDeletingInvite] = useState<AuthorizedEmail | null>(null);

  const departments = useQuery<Department[]>(async () => {
    const { data } = await supabase.from('departments').select('*').order('name');
    return (data ?? []) as Department[];
  });

  const positions = useQuery<Position[]>(async () => {
    const { data } = await supabase.from('positions').select('*').order('access_level', { ascending: false });
    return (data ?? []) as Position[];
  });

  const profiles = useQuery<Profile[]>(async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    return (data ?? []) as Profile[];
  });

  const invites = useQuery<AuthorizedEmail[]>(async () => {
    const { data } = await supabase.from('authorized_emails').select('*').order('created_at', { ascending: false });
    return (data ?? []) as AuthorizedEmail[];
  });

  const logs = useQuery<ActivityLog[]>(async () => {
    const { data } = await supabase
      .from('activity_logs')
      .select('*, user:profiles(id, full_name)')
      .order('created_at', { ascending: false })
      .limit(50);
    return (data ?? []) as ActivityLog[];
  });

  const saveSection = async (key: string, value: unknown, message: string) => {
    if (saving) return;
    setSaving(true);
    const { error } = await settings.saveSetting(key, value);
    setSaving(false);
    if (error) {
      toast.error(`Erro ao salvar: ${error}`);
      return;
    }
    toast.success(message);
    void logActivity({ action: 'update', module: 'configuracoes', summary: `Atualizou configurações (${key})` });
  };

  const saveDepartment = async () => {
    if (!deptForm.name.trim()) {
      toast.error('Informe o nome da diretoria.');
      return;
    }
    const payload = {
      name: deptForm.name.trim(),
      description: deptForm.description.trim() || null,
      responsible_id: deptForm.responsible_id || null,
      is_active: deptForm.is_active,
    };
    const result = editingDept
      ? await supabase.from('departments').update(payload).eq('id', editingDept.id)
      : await supabase.from('departments').insert(payload);
    if (result.error) {
      toast.error(`Erro: ${result.error.message}`);
      return;
    }
    toast.success('Diretoria salva.');
    setDeptModal(false);
    void departments.refetch();
  };

  const savePosition = async () => {
    if (!posForm.name.trim()) {
      toast.error('Informe o nome do cargo.');
      return;
    }
    const payload = {
      name: posForm.name.trim(),
      description: posForm.description.trim() || null,
      access_level: Number(posForm.access_level) || 1,
    };
    const result = editingPos
      ? await supabase.from('positions').update(payload).eq('id', editingPos.id)
      : await supabase.from('positions').insert(payload);
    if (result.error) {
      toast.error(`Erro: ${result.error.message}`);
      return;
    }
    toast.success('Cargo salvo.');
    setPosModal(false);
    void positions.refetch();
  };

  const sendInvite = async () => {
    const email = inviteForm.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error('Informe um e-mail válido.');
      return;
    }
    const { error } = await supabase.from('authorized_emails').insert({
      email,
      role: inviteForm.role,
      department_id: inviteForm.department_id || null,
      invited_by: profile?.id ?? null,
    });
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Este e-mail já foi convidado.' : error.message);
      return;
    }
    toast.success(`Convite registrado. ${email} já pode se cadastrar na tela de cadastro.`);
    void logActivity({
      action: 'permission_change',
      module: 'usuarios',
      summary: `Convidou ${email} como ${roleLabels[inviteForm.role]}`,
    });
    setInviteModal(false);
    setInviteForm({ email: '', role: 'member', department_id: '' });
    void invites.refetch();
  };

  const removeInvite = async () => {
    if (!deletingInvite) return;
    await supabase.from('authorized_emails').delete().eq('id', deletingInvite.id);
    toast.success('Convite removido.');
    setDeletingInvite(null);
    void invites.refetch();
  };

  const updateUserRole = async (user: Profile, role: UserRole) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', user.id);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    toast.success(`${user.full_name} agora é ${roleLabels[role]}.`);
    void logActivity({
      action: 'permission_change',
      module: 'usuarios',
      entityType: 'profile',
      entityId: user.id,
      summary: `Alterou o perfil de ${user.full_name} para ${roleLabels[role]}`,
    });
    void profiles.refetch();
  };

  const toggleUserActive = async (user: Profile) => {
    const { error } = await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    toast.success(user.is_active ? 'Usuário desativado.' : 'Usuário reativado.');
    void profiles.refetch();
  };

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Administração geral do sistema."
        breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Configurações' }]}
      />

      <Tabs
        tabs={[
          { id: 'general', label: 'Geral' },
          { id: 'branding', label: 'Identidade visual' },
          { id: 'departments', label: 'Diretorias' },
          { id: 'positions', label: 'Cargos' },
          { id: 'users', label: 'Usuários' },
          { id: 'categories', label: 'Categorias' },
          { id: 'security', label: 'Segurança' },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-4"
      />

      {tab === 'general' && (
        <Card className="max-w-2xl p-5">
          <div className="grid gap-4">
            <Input
              label="Nome da Atlética"
              value={generalForm.organizationName}
              onChange={(e) => setGeneralForm({ ...generalForm, organizationName: e.target.value })}
            />
            <Input
              label="Nome do sistema"
              value={generalForm.systemName}
              onChange={(e) => setGeneralForm({ ...generalForm, systemName: e.target.value })}
              hint="Aparece na sidebar, no login e no título das páginas."
            />
            <Textarea
              label="Descrição"
              value={generalForm.description}
              onChange={(e) => setGeneralForm({ ...generalForm, description: e.target.value })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="E-mail de contato"
                type="email"
                value={generalForm.contactEmail}
                onChange={(e) => setGeneralForm({ ...generalForm, contactEmail: e.target.value })}
              />
              <Input
                label="Instagram"
                placeholder="@atletica"
                value={generalForm.instagram}
                onChange={(e) => setGeneralForm({ ...generalForm, instagram: e.target.value })}
              />
            </div>
            <Input
              label="Site"
              value={generalForm.website}
              onChange={(e) => setGeneralForm({ ...generalForm, website: e.target.value })}
            />
            <Input
              label="Nome do plano de sócios"
              value={clubForm.planName}
              onChange={(e) => setClubForm({ ...clubForm, planName: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button
                loading={saving}
                icon={<Save size={16} />}
                onClick={() => {
                  void saveSection('general', generalForm, 'Dados gerais salvos.').then(() =>
                    saveSection('club', clubForm, 'Plano de sócios atualizado.'),
                  );
                }}
              >
                Salvar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {tab === 'branding' && (
        <Card className="max-w-2xl p-5">
          <div className="grid gap-4">
            <p className="text-sm text-[var(--color-text-secondary)]">
              As cores abaixo sobrescrevem a paleta padrão definida em <code>src/styles/theme.css</code>. Deixe em
              branco para usar o padrão.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-end gap-2">
                <Input
                  label="Cor primária"
                  placeholder="#A31621"
                  value={brandingForm.primaryColor}
                  onChange={(e) => setBrandingForm({ ...brandingForm, primaryColor: e.target.value })}
                />
                <span
                  aria-hidden
                  className="mb-0.5 h-9 w-9 shrink-0 rounded-lg border border-[var(--color-border)]"
                  style={{ backgroundColor: brandingForm.primaryColor || 'var(--color-primary)' }}
                />
              </div>
              <div className="flex items-end gap-2">
                <Input
                  label="Cor secundária"
                  placeholder="#F2B705"
                  value={brandingForm.secondaryColor}
                  onChange={(e) => setBrandingForm({ ...brandingForm, secondaryColor: e.target.value })}
                />
                <span
                  aria-hidden
                  className="mb-0.5 h-9 w-9 shrink-0 rounded-lg border border-[var(--color-border)]"
                  style={{ backgroundColor: brandingForm.secondaryColor || 'var(--color-secondary)' }}
                />
              </div>
            </div>
            <Input
              label="URL do logotipo"
              placeholder="https://…"
              value={brandingForm.logoUrl}
              onChange={(e) => setBrandingForm({ ...brandingForm, logoUrl: e.target.value })}
              hint="Envie o arquivo para o bucket público 'branding' no Supabase e cole a URL pública aqui."
            />
            <Select
              label="Tema padrão"
              options={[
                { value: 'system', label: 'Seguir o sistema' },
                { value: 'light', label: 'Claro' },
                { value: 'dark', label: 'Escuro' },
              ]}
              value={brandingForm.defaultTheme}
              onChange={(e) => setBrandingForm({ ...brandingForm, defaultTheme: e.target.value as ThemePreference })}
            />
            <div className="flex justify-end">
              <Button
                loading={saving}
                icon={<Save size={16} />}
                onClick={() => void saveSection('branding', brandingForm, 'Identidade visual salva.')}
              >
                Salvar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {tab === 'departments' && (
        <div className="space-y-3">
          <Button
            size="sm"
            icon={<Plus size={15} />}
            onClick={() => {
              setEditingDept(null);
              setDeptForm({ name: '', description: '', responsible_id: '', is_active: true });
              setDeptModal(true);
            }}
          >
            Nova diretoria
          </Button>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(departments.data ?? []).map((d) => (
              <Card key={d.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{d.name}</p>
                    {d.description && <p className="text-xs text-[var(--color-text-muted)]">{d.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge tone={d.is_active ? 'success' : 'neutral'}>{d.is_active ? 'Ativa' : 'Inativa'}</Badge>
                    <IconButton
                      label="Editar diretoria"
                      size="sm"
                      onClick={() => {
                        setEditingDept(d);
                        setDeptForm({
                          name: d.name,
                          description: d.description ?? '',
                          responsible_id: d.responsible_id ?? '',
                          is_active: d.is_active,
                        });
                        setDeptModal(true);
                      }}
                    >
                      <Pencil size={14} />
                    </IconButton>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === 'positions' && (
        <div className="space-y-3">
          <Button
            size="sm"
            icon={<Plus size={15} />}
            onClick={() => {
              setEditingPos(null);
              setPosForm({ name: '', description: '', access_level: '1' });
              setPosModal(true);
            }}
          >
            Novo cargo
          </Button>
          <Card>
            <ul className="divide-y divide-[var(--color-border)]">
              {(positions.data ?? []).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-3">
                  <span>
                    <span className="block text-sm font-medium">{p.name}</span>
                    {p.description && <span className="text-xs text-[var(--color-text-muted)]">{p.description}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge tone="info">Nível {p.access_level}</Badge>
                    <IconButton
                      label="Editar cargo"
                      size="sm"
                      onClick={() => {
                        setEditingPos(p);
                        setPosForm({ name: p.name, description: p.description ?? '', access_level: String(p.access_level) });
                        setPosModal(true);
                      }}
                    >
                      <Pencil size={14} />
                    </IconButton>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Convites</h3>
            <Button size="sm" icon={<Mail size={15} />} onClick={() => setInviteModal(true)}>
              Convidar usuário
            </Button>
          </div>
          <Card>
            {(invites.data ?? []).length === 0 ? (
              <EmptyState
                title="Nenhum convite registrado"
                description="Convide um e-mail para permitir que a pessoa crie a conta na tela de cadastro."
              />
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {(invites.data ?? []).map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-2 px-4 py-3">
                    <span>
                      <span className="block text-sm font-medium">{inv.email}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">{roleLabels[inv.role]}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone={inv.used_at ? 'success' : 'warning'}>{inv.used_at ? 'Utilizado' : 'Pendente'}</Badge>
                      {!inv.used_at && (
                        <IconButton label="Remover convite" size="sm" onClick={() => setDeletingInvite(inv)}>
                          <Trash2 size={14} className="text-[var(--color-danger)]" />
                        </IconButton>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <h3 className="text-sm font-semibold">Usuários do sistema</h3>
          <Card>
            <ul className="divide-y divide-[var(--color-border)]">
              {(profiles.data ?? []).map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Avatar name={u.full_name} src={u.avatar_url} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{u.full_name}</span>
                    <span className="block truncate text-xs text-[var(--color-text-muted)]">{u.email}</span>
                  </span>
                  <select
                    aria-label={`Perfil de ${u.full_name}`}
                    value={u.role}
                    disabled={u.id === profile?.id}
                    onChange={(e) => void updateUserRole(u, e.target.value as UserRole)}
                    className="h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs"
                  >
                    {roleOptions.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <Switch
                    checked={u.is_active}
                    onChange={() => void toggleUserActive(u)}
                    disabled={u.id === profile?.id}
                    label={u.is_active ? 'Ativo' : 'Inativo'}
                  />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {tab === 'categories' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold">Categorias de documentos</h3>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {docCats.map((c) => (
                <span key={c} className="flex items-center gap-1 rounded-full bg-[var(--color-surface-secondary)] px-2.5 py-1 text-xs">
                  {c}
                  <button aria-label={`Remover ${c}`} onClick={() => setDocCats(docCats.filter((x) => x !== c))}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                aria-label="Nova categoria de documento"
                placeholder="Nova categoria…"
                value={newDocCat}
                onChange={(e) => setNewDocCat(e.target.value)}
              />
              <IconButton
                label="Adicionar categoria"
                variant="secondary"
                onClick={() => {
                  if (newDocCat.trim() && !docCats.includes(newDocCat.trim())) {
                    setDocCats([...docCats, newDocCat.trim()]);
                    setNewDocCat('');
                  }
                }}
              >
                <Plus size={16} />
              </IconButton>
            </div>
            <Button
              size="sm"
              className="mt-3 w-full"
              loading={saving}
              onClick={() => void saveSection('doc_categories', docCats, 'Categorias de documentos salvas.')}
            >
              Salvar
            </Button>
          </Card>

          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold">Categorias de eventos</h3>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {eventCats.map((c) => (
                <span key={c} className="flex items-center gap-1 rounded-full bg-[var(--color-surface-secondary)] px-2.5 py-1 text-xs">
                  {c}
                  <button aria-label={`Remover ${c}`} onClick={() => setEventCats(eventCats.filter((x) => x !== c))}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                aria-label="Nova categoria de evento"
                placeholder="Nova categoria…"
                value={newEventCat}
                onChange={(e) => setNewEventCat(e.target.value)}
              />
              <IconButton
                label="Adicionar categoria"
                variant="secondary"
                onClick={() => {
                  if (newEventCat.trim() && !eventCats.includes(newEventCat.trim())) {
                    setEventCats([...eventCats, newEventCat.trim()]);
                    setNewEventCat('');
                  }
                }}
              >
                <Plus size={16} />
              </IconButton>
            </div>
            <Button
              size="sm"
              className="mt-3 w-full"
              loading={saving}
              onClick={() => void saveSection('event_categories', eventCats, 'Categorias de eventos salvas.')}
            >
              Salvar
            </Button>
          </Card>

          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold">Etiquetas de tarefas</h3>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {labels.map((l) => (
                <span key={l.name} className="flex items-center gap-1 rounded-full bg-[var(--color-surface-secondary)] px-2.5 py-1 text-xs">
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                  {l.name}
                  <button aria-label={`Remover ${l.name}`} onClick={() => setLabels(labels.filter((x) => x.name !== l.name))}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                aria-label="Nova etiqueta"
                placeholder="Nova etiqueta…"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
              <IconButton
                label="Adicionar etiqueta"
                variant="secondary"
                onClick={() => {
                  if (newLabel.trim() && !labels.some((l) => l.name === newLabel.trim())) {
                    setLabels([...labels, { name: newLabel.trim(), color: '#6B7280' }]);
                    setNewLabel('');
                  }
                }}
              >
                <Plus size={16} />
              </IconButton>
            </div>
            <Button
              size="sm"
              className="mt-3 w-full"
              loading={saving}
              onClick={() => void saveSection('task_labels', labels, 'Etiquetas salvas.')}
            >
              Salvar
            </Button>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              Categorias financeiras são gerenciadas no módulo Financeiro → aba Categorias.
            </p>
          </Card>
        </div>
      )}

      {tab === 'security' && (
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck size={16} aria-hidden />
              Segurança da conta
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              A alteração de senha é feita na página <strong>Meu perfil</strong> (menu do avatar). O encerramento de
              sessão em outros dispositivos acontece automaticamente quando a senha é alterada. As permissões de dados
              são garantidas por Row Level Security no Supabase — esconder botões no front-end é apenas uma camada
              extra de usabilidade.
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Registro de atividades (auditoria)</h3>
            {(logs.data ?? []).length === 0 ? (
              <EmptyState title="Sem registros" description="As ações importantes dos usuários aparecerão aqui." />
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {(logs.data ?? []).map((log) => (
                  <li key={log.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate">
                        <span className="font-medium">{log.user?.full_name ?? 'Usuário'}</span>{' '}
                        <span className="text-[var(--color-text-secondary)]">
                          {log.summary ?? `${log.action} em ${log.module}`}
                        </span>
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {log.module} · {formatDateTime(log.created_at)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-[var(--color-text-muted)]">{formatRelative(log.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={deptModal}
        onClose={() => setDeptModal(false)}
        title={editingDept ? 'Editar diretoria' : 'Nova diretoria'}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeptModal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void saveDepartment()}>Salvar</Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Input label="Nome" required value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} />
          <Textarea label="Descrição" value={deptForm.description} onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })} />
          <Select
            label="Responsável"
            options={(profiles.data ?? []).map((p) => ({ value: p.id, label: p.full_name }))}
            placeholder="Selecione…"
            value={deptForm.responsible_id}
            onChange={(e) => setDeptForm({ ...deptForm, responsible_id: e.target.value })}
          />
          <Switch
            checked={deptForm.is_active}
            onChange={(checked) => setDeptForm({ ...deptForm, is_active: checked })}
            label="Diretoria ativa"
          />
        </div>
      </Modal>

      <Modal
        open={posModal}
        onClose={() => setPosModal(false)}
        title={editingPos ? 'Editar cargo' : 'Novo cargo'}
        footer={
          <>
            <Button variant="outline" onClick={() => setPosModal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void savePosition()}>Salvar</Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Input label="Nome" required value={posForm.name} onChange={(e) => setPosForm({ ...posForm, name: e.target.value })} />
          <Textarea label="Descrição" value={posForm.description} onChange={(e) => setPosForm({ ...posForm, description: e.target.value })} />
          <Input
            label="Nível de acesso (1 a 5)"
            type="number"
            min={1}
            max={5}
            value={posForm.access_level}
            onChange={(e) => setPosForm({ ...posForm, access_level: e.target.value })}
          />
        </div>
      </Modal>

      <Modal
        open={inviteModal}
        onClose={() => setInviteModal(false)}
        title="Convidar usuário"
        footer={
          <>
            <Button variant="outline" onClick={() => setInviteModal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void sendInvite()}>Registrar convite</Button>
          </>
        }
      >
        <div className="grid gap-4">
          <p className="rounded-lg bg-[var(--color-info-soft)] px-3 py-2 text-sm text-[var(--color-info)]">
            Após registrar o convite, envie o link da tela de cadastro para a pessoa. Somente e-mails convidados
            conseguem criar conta.
          </p>
          <Input
            label="E-mail"
            type="email"
            required
            value={inviteForm.email}
            onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
          />
          <Select
            label="Perfil de acesso"
            options={roleOptions}
            value={inviteForm.role}
            onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as UserRole })}
          />
          <Select
            label="Diretoria"
            options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
            placeholder="Nenhuma"
            value={inviteForm.department_id}
            onChange={(e) => setInviteForm({ ...inviteForm, department_id: e.target.value })}
          />
        </div>
      </Modal>

      <ConfirmModal
        open={deletingInvite !== null}
        onClose={() => setDeletingInvite(null)}
        onConfirm={removeInvite}
        title="Remover convite"
        message={`Remover o convite de ${deletingInvite?.email ?? ''}? A pessoa não conseguirá mais se cadastrar.`}
        confirmLabel="Remover"
      />
    </div>
  );
}
