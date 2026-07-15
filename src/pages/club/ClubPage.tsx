import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { addMonths, format } from 'date-fns';
import { Plus, BadgeCheck, Pencil, CreditCard, Gift, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useQuery } from '@/hooks/useQuery';
import { useDebounce } from '@/hooks/useDebounce';
import type { Benefit, ClubMember, ClubStatus, MembershipPayment } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Input, Select, SearchInput, Textarea } from '@/components/ui/Input';
import { Card, KpiCard } from '@/components/ui/Card';
import { Badge, clubStatusTones } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState, ErrorState } from '@/components/ui/State';
import { clubStatusLabels } from '@/utils/labels';
import { formatCurrency, formatDate, todayISO } from '@/utils/format';

interface ClubForm {
  full_name: string;
  registration: string;
  course: string;
  email: string;
  phone: string;
  card_number: string;
  start_date: string;
  valid_until: string;
  status: ClubStatus;
  notes: string;
}

const emptyForm: ClubForm = {
  full_name: '', registration: '', course: '', email: '', phone: '',
  card_number: '', start_date: '', valid_until: '', status: 'pending', notes: '',
};

export function ClubPage() {
  const { can, profile } = useAuth();
  const { club } = useSettings();
  const toast = useToast();
  const canManage = can('club.manage');
  const canFinance = profile ? ['admin', 'treasury'].includes(profile.role) : false;

  const [tab, setTab] = useState('members');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClubMember | null>(null);
  const [form, setForm] = useState<ClubForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [cardMember, setCardMember] = useState<ClubMember | null>(null);
  const [paymentMember, setPaymentMember] = useState<ClubMember | null>(null);
  const [payments, setPayments] = useState<MembershipPayment[]>([]);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: '', paid_at: todayISO() });
  const [benefitModal, setBenefitModal] = useState(false);
  const [benefitForm, setBenefitForm] = useState({ title: '', description: '', partner_name: '' });
  const debouncedSearch = useDebounce(search);

  const members = useQuery<ClubMember[]>(async () => {
    let query = supabase.from('members_club').select('*').order('full_name');
    if (debouncedSearch) query = query.ilike('full_name', `%${debouncedSearch}%`);
    if (statusFilter) query = query.eq('status', statusFilter as ClubStatus);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as ClubMember[];
  }, [debouncedSearch, statusFilter]);

  const benefits = useQuery<Benefit[]>(async () => {
    const { data } = await supabase.from('benefits').select('*').order('title');
    return (data ?? []) as Benefit[];
  });

  const stats = useMemo(() => {
    const list = members.data ?? [];
    return {
      active: list.filter((m) => m.status === 'active').length,
      pending: list.filter((m) => m.status === 'pending').length,
      expired: list.filter((m) => m.status === 'expired').length,
    };
  }, [members.data]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      start_date: todayISO(),
      valid_until: format(addMonths(new Date(), club.defaultValidityMonths), 'yyyy-MM-dd'),
    });
    setModalOpen(true);
  };

  const openEdit = (m: ClubMember) => {
    setEditing(m);
    setForm({
      full_name: m.full_name,
      registration: m.registration ?? '',
      course: m.course ?? '',
      email: m.email ?? '',
      phone: m.phone ?? '',
      card_number: m.card_number ?? '',
      start_date: m.start_date ?? '',
      valid_until: m.valid_until ?? '',
      status: m.status,
      notes: m.notes ?? '',
    });
    setModalOpen(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.full_name.trim()) {
      toast.error('Informe o nome do sócio.');
      return;
    }
    setSaving(true);
    const payload = {
      full_name: form.full_name.trim(),
      registration: form.registration.trim() || null,
      course: form.course.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      card_number: form.card_number.trim() || null,
      plan_name: club.planName,
      start_date: form.start_date || null,
      valid_until: form.valid_until || null,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    const result = editing
      ? await supabase.from('members_club').update(payload).eq('id', editing.id)
      : await supabase.from('members_club').insert(payload);
    setSaving(false);
    if (result.error) {
      toast.error(`Erro: ${result.error.message}`);
      return;
    }
    toast.success('Sócio salvo.');
    setModalOpen(false);
    void members.refetch();
  };

  const openPayments = async (m: ClubMember) => {
    setPaymentMember(m);
    setPaymentForm({ amount: '', method: '', paid_at: todayISO() });
    const { data } = await supabase
      .from('membership_payments')
      .select('*')
      .eq('member_club_id', m.id)
      .order('paid_at', { ascending: false });
    setPayments((data ?? []) as MembershipPayment[]);
  };

  const addPayment = async () => {
    if (!paymentMember || !paymentForm.amount || Number(paymentForm.amount) <= 0) {
      toast.error('Informe o valor do pagamento.');
      return;
    }
    const { error } = await supabase.from('membership_payments').insert({
      member_club_id: paymentMember.id,
      amount: Number(paymentForm.amount),
      paid_at: paymentForm.paid_at,
      method: paymentForm.method.trim() || null,
    });
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    await supabase
      .from('members_club')
      .update({
        status: 'active',
        valid_until: format(addMonths(new Date(paymentForm.paid_at), club.defaultValidityMonths), 'yyyy-MM-dd'),
      })
      .eq('id', paymentMember.id);
    toast.success('Pagamento registrado e plano renovado.');
    void openPayments(paymentMember);
    void members.refetch();
  };

  const saveBenefit = async (e: FormEvent) => {
    e.preventDefault();
    if (!benefitForm.title.trim()) {
      toast.error('Informe o título do benefício.');
      return;
    }
    const { error } = await supabase.from('benefits').insert({
      title: benefitForm.title.trim(),
      description: benefitForm.description.trim() || null,
      partner_name: benefitForm.partner_name.trim() || null,
    });
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    toast.success('Benefício criado.');
    setBenefitModal(false);
    setBenefitForm({ title: '', description: '', partner_name: '' });
    void benefits.refetch();
  };

  const columns: Column<ClubMember>[] = [
    {
      key: 'name',
      header: 'Sócio',
      render: (m) => (
        <span className="flex items-center gap-2">
          <Avatar name={m.full_name} src={m.photo_url} size="sm" />
          <span>
            <span className="block font-medium">{m.full_name}</span>
            <span className="text-xs text-[var(--color-text-muted)]">{m.course ?? '—'}</span>
          </span>
        </span>
      ),
    },
    { key: 'card', header: 'Carteirinha', render: (m) => m.card_number ?? '—', hideOnMobile: true },
    { key: 'valid', header: 'Validade', render: (m) => formatDate(m.valid_until) },
    {
      key: 'status',
      header: 'Status',
      render: (m) => <Badge tone={clubStatusTones[m.status]}>{clubStatusLabels[m.status]}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (m) => (
        <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <IconButton label="Carteirinha digital" size="sm" onClick={() => setCardMember(m)}>
            <CreditCard size={15} />
          </IconButton>
          {canFinance && (
            <IconButton label="Pagamentos" size="sm" onClick={() => void openPayments(m)}>
              <DollarSign size={15} />
            </IconButton>
          )}
          {canManage && (
            <IconButton label="Editar" size="sm" onClick={() => openEdit(m)}>
              <Pencil size={15} />
            </IconButton>
          )}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Sócios"
        description={`Programa ${club.planName} — gestão de sócios, pagamentos e benefícios.`}
        breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Sócios' }]}
        actions={
          canManage && (
            <Button icon={<Plus size={16} />} onClick={openCreate}>
              Novo sócio
            </Button>
          )
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <KpiCard title="Sócios ativos" value={stats.active} tone="success" loading={members.loading} />
        <KpiCard title="Pendentes" value={stats.pending} tone="warning" loading={members.loading} />
        <KpiCard title="Vencidos" value={stats.expired} tone={stats.expired > 0 ? 'danger' : 'default'} loading={members.loading} />
      </div>

      <Tabs
        tabs={[
          { id: 'members', label: 'Sócios', count: (members.data ?? []).length },
          { id: 'benefits', label: 'Benefícios', count: (benefits.data ?? []).length },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-4"
      />

      {tab === 'members' ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput
              placeholder="Buscar sócio…"
              aria-label="Buscar sócio"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              containerClassName="flex-1"
            />
            <Select
              aria-label="Filtrar por status"
              options={Object.entries(clubStatusLabels).map(([value, label]) => ({ value, label }))}
              placeholder="Todos os status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="sm:w-44"
            />
          </div>

          {members.error ? (
            <ErrorState message={members.error} onRetry={() => void members.refetch()} />
          ) : (
            <Card>
              <DataTable
                columns={columns}
                rows={members.data ?? []}
                rowKey={(m) => m.id}
                loading={members.loading}
                emptyState={
                  <EmptyState
                    icon={<BadgeCheck size={24} />}
                    title="Nenhum sócio cadastrado"
                    description={`Cadastre o primeiro ${club.planName} para começar.`}
                    actionLabel={canManage ? 'Cadastrar sócio' : undefined}
                    onAction={canManage ? openCreate : undefined}
                  />
                }
              />
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {canManage && (
            <Button size="sm" icon={<Plus size={15} />} onClick={() => setBenefitModal(true)}>
              Novo benefício
            </Button>
          )}
          {(benefits.data ?? []).length === 0 ? (
            <EmptyState
              icon={<Gift size={24} />}
              title="Nenhum benefício cadastrado"
              description="Cadastre descontos e vantagens para os sócios."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(benefits.data ?? []).map((b) => (
                <Card key={b.id} className="p-4">
                  <p className="font-semibold">{b.title}</p>
                  {b.partner_name && <p className="text-xs text-[var(--color-text-muted)]">{b.partner_name}</p>}
                  {b.description && (
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{b.description}</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar sócio' : 'Novo sócio'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={(e) => void save(e as unknown as FormEvent)}>
              Salvar
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => void save(e)} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input label="Nome completo" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <Input label="Matrícula" value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} />
          <Input label="Curso" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} />
          <Input label="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Nº da carteirinha" value={form.card_number} onChange={(e) => setForm({ ...form, card_number: e.target.value })} />
          <Select
            label="Status"
            options={Object.entries(clubStatusLabels).map(([value, label]) => ({ value, label }))}
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as ClubStatus })}
          />
          <Input label="Início" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          <Input label="Validade" type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
          <div className="sm:col-span-2">
            <Textarea label="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </form>
      </Modal>

      <Modal open={cardMember !== null} onClose={() => setCardMember(null)} title="Carteirinha digital" size="sm">
        {cardMember && (
          <div className="overflow-hidden rounded-2xl bg-[var(--color-primary)] p-5 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest opacity-80">{club.planName}</p>
              <BadgeCheck size={20} aria-hidden />
            </div>
            <div className="mt-6 flex items-center gap-3">
              <Avatar name={cardMember.full_name} src={cardMember.photo_url} size="lg" className="ring-2 ring-white/40" />
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">{cardMember.full_name}</p>
                <p className="text-sm opacity-80">{cardMember.course ?? ''}</p>
              </div>
            </div>
            <div className="mt-6 flex items-end justify-between text-sm">
              <div>
                <p className="text-[10px] uppercase opacity-70">Carteirinha</p>
                <p className="font-mono font-semibold">{cardMember.card_number ?? '—'}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase opacity-70">Válida até</p>
                <p className="font-semibold">{formatDate(cardMember.valid_until)}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={paymentMember !== null}
        onClose={() => setPaymentMember(null)}
        title={`Pagamentos — ${paymentMember?.full_name ?? ''}`}
      >
        {canFinance && (
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <Input
              label="Valor (R$)"
              type="number"
              min={0.01}
              step="0.01"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
            />
            <Input
              label="Data"
              type="date"
              value={paymentForm.paid_at}
              onChange={(e) => setPaymentForm({ ...paymentForm, paid_at: e.target.value })}
            />
            <Input
              label="Forma"
              placeholder="Pix…"
              value={paymentForm.method}
              onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
            />
            <div className="flex items-end">
              <Button className="w-full" onClick={() => void addPayment()}>
                Registrar
              </Button>
            </div>
          </div>
        )}
        {payments.length === 0 ? (
          <EmptyState title="Sem pagamentos" description="Os pagamentos e renovações aparecerão aqui." />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {formatDate(p.paid_at)}
                  {p.method ? ` · ${p.method}` : ''}
                </span>
                <span className="font-semibold text-[var(--color-success)]">{formatCurrency(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal
        open={benefitModal}
        onClose={() => setBenefitModal(false)}
        title="Novo benefício"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setBenefitModal(false)}>
              Cancelar
            </Button>
            <Button onClick={(e) => void saveBenefit(e as unknown as FormEvent)}>Criar</Button>
          </>
        }
      >
        <form onSubmit={(e) => void saveBenefit(e)} className="grid gap-4">
          <Input label="Título" required value={benefitForm.title} onChange={(e) => setBenefitForm({ ...benefitForm, title: e.target.value })} />
          <Input label="Parceiro" value={benefitForm.partner_name} onChange={(e) => setBenefitForm({ ...benefitForm, partner_name: e.target.value })} />
          <Textarea label="Descrição" value={benefitForm.description} onChange={(e) => setBenefitForm({ ...benefitForm, description: e.target.value })} />
        </form>
      </Modal>
    </div>
  );
}
