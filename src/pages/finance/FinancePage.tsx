import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Download, Trash2, Pencil, Wallet, Paperclip, CheckCircle2 } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useQuery } from '@/hooks/useQuery';
import { useDebounce } from '@/hooks/useDebounce';
import { logActivity } from '@/services/activityLog';
import { uploadFile, downloadFile } from '@/services/storage';
import type {
  Sector,
  Event,
  FinancialCategory,
  FinancialTransaction,
  Supplier,
  TransactionStatus,
  TransactionType,
} from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Input, Select, SearchInput, Textarea } from '@/components/ui/Input';
import { Card, KpiCard } from '@/components/ui/Card';
import { Badge, transactionStatusTones } from '@/components/ui/Badge';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState, ErrorState } from '@/components/ui/State';
import { ChartCard, chartTooltipStyle } from '@/components/charts/ChartCard';
import { transactionStatusLabels } from '@/utils/labels';
import { formatCurrency, formatDate, todayISO } from '@/utils/format';
import { exportToCsv } from '@/utils/csv';

interface TransactionForm {
  type: TransactionType;
  description: string;
  amount: string;
  category_id: string;
  date: string;
  due_date: string;
  paid_at: string;
  status: TransactionStatus;
  payment_method: string;
  event_id: string;
  sector_id: string;
  supplier_id: string;
  recurrence: string;
  notes: string;
}

const emptyTransaction: TransactionForm = {
  type: 'expense',
  description: '',
  amount: '',
  category_id: '',
  date: todayISO(),
  due_date: '',
  paid_at: '',
  status: 'pending',
  payment_method: '',
  event_id: '',
  sector_id: '',
  supplier_id: '',
  recurrence: '',
  notes: '',
};

const PIE_COLORS = ['#2C2E43', '#FFC100', '#2563EB', '#16A34A', '#9333EA', '#EA580C', '#0891B2', '#6B7280'];

export function FinancePage() {
  const { profile, can } = useAuth();
  const toast = useToast();
  const canManage = can('finance.manage');
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('tipo') ?? '');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialTransaction | null>(null);
  const [form, setForm] = useState<TransactionForm>(emptyTransaction);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<FinancialTransaction | null>(null);
  const [supplierModal, setSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', contact_name: '', phone: '', email: '', category: '', notes: '' });
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [categoryModal, setCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', type: 'expense' as TransactionType });
  const debouncedSearch = useDebounce(search);

  const categories = useQuery<FinancialCategory[]>(async () => {
    const { data } = await supabase.from('financial_categories').select('*').eq('is_active', true).order('name');
    return (data ?? []) as FinancialCategory[];
  });

  const suppliers = useQuery<Supplier[]>(async () => {
    const { data } = await supabase.from('suppliers').select('*').order('name');
    return (data ?? []) as Supplier[];
  });

  const events = useQuery<Pick<Event, 'id' | 'name'>[]>(async () => {
    const { data } = await supabase.from('events').select('id, name').order('start_date', { ascending: false });
    return (data ?? []) as Pick<Event, 'id' | 'name'>[];
  });

  const departments = useQuery<Sector[]>(async () => {
    const { data } = await supabase.from('sectors').select('*').order('name');
    return (data ?? []) as Sector[];
  });

  const transactions = useQuery<FinancialTransaction[]>(async () => {
    const { data, error } = await supabase
      .from('financial_transactions')
      .select('*, category:financial_categories(*), event:events(id, name), supplier:suppliers(id, name)')
      .order('date', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as FinancialTransaction[];
  });

  const filtered = useMemo(() => {
    return (transactions.data ?? []).filter((t) => {
      if (debouncedSearch && !t.description.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
      if (typeFilter && t.type !== typeFilter) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (categoryFilter && t.category_id !== categoryFilter) return false;
      return true;
    });
  }, [transactions.data, debouncedSearch, typeFilter, statusFilter, categoryFilter]);

  const stats = useMemo(() => {
    const list = (transactions.data ?? []).filter((t) => t.status !== 'cancelled');
    const paid = list.filter((t) => t.status === 'paid');
    const income = paid.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expense = paid.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const pending = list.filter((t) => t.status === 'pending').length;
    const today = todayISO();
    const overdue = list.filter((t) => t.status === 'pending' && t.due_date && t.due_date < today).length;

    const byMonth = new Map<string, { receitas: number; despesas: number }>();
    for (let i = 5; i >= 0; i -= 1) {
      byMonth.set(format(subMonths(new Date(), i), 'yyyy-MM'), { receitas: 0, despesas: 0 });
    }
    for (const t of list) {
      const bucket = byMonth.get(t.date.slice(0, 7));
      if (!bucket) continue;
      if (t.type === 'income') bucket.receitas += Number(t.amount);
      else bucket.despesas += Number(t.amount);
    }
    const monthly = Array.from(byMonth.entries()).map(([key, v]) => ({
      month: format(new Date(`${key}-15`), 'MMM', { locale: ptBR }),
      ...v,
    }));

    const byCategory = new Map<string, number>();
    for (const t of list.filter((x) => x.type === 'expense')) {
      const name = t.category?.name ?? 'Sem categoria';
      byCategory.set(name, (byCategory.get(name) ?? 0) + Number(t.amount));
    }
    const categoryData = Array.from(byCategory.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    return { balance: income - expense, income, expense, pending, overdue, monthly, categoryData };
  }, [transactions.data]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyTransaction);
    setReceiptFile(null);
    setModalOpen(true);
  };

  const openEdit = (t: FinancialTransaction) => {
    setEditing(t);
    setForm({
      type: t.type,
      description: t.description,
      amount: t.amount.toString(),
      category_id: t.category_id ?? '',
      date: t.date,
      due_date: t.due_date ?? '',
      paid_at: t.paid_at ?? '',
      status: t.status,
      payment_method: t.payment_method ?? '',
      event_id: t.event_id ?? '',
      sector_id: t.sector_id ?? '',
      supplier_id: t.supplier_id ?? '',
      recurrence: t.recurrence ?? '',
      notes: t.notes ?? '',
    });
    setReceiptFile(null);
    setModalOpen(true);
  };

  const saveTransaction = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.description.trim() || !form.amount || Number(form.amount) <= 0) {
      toast.error('Informe descrição e um valor maior que zero.');
      return;
    }
    setSaving(true);

    let receiptPath = editing?.receipt_path ?? null;
    if (receiptFile) {
      const { path, error } = await uploadFile('financial-receipts', 'comprovantes', receiptFile);
      if (error || !path) {
        setSaving(false);
        toast.error(error ?? 'Erro ao enviar comprovante.');
        return;
      }
      receiptPath = path;
    }

    const payload = {
      type: form.type,
      description: form.description.trim(),
      amount: Number(form.amount),
      category_id: form.category_id || null,
      date: form.date,
      due_date: form.due_date || null,
      paid_at: form.paid_at || null,
      status: form.status,
      payment_method: form.payment_method.trim() || null,
      event_id: form.event_id || null,
      sector_id: form.sector_id || null,
      supplier_id: form.supplier_id || null,
      recurrence: form.recurrence.trim() || null,
      notes: form.notes.trim() || null,
      receipt_path: receiptPath,
    };

    const result = editing
      ? await supabase.from('financial_transactions').update(payload).eq('id', editing.id)
      : await supabase.from('financial_transactions').insert({ ...payload, created_by: profile?.id ?? null });

    setSaving(false);
    if (result.error) {
      toast.error(`Erro ao salvar: ${result.error.message}`);
      return;
    }
    toast.success(editing ? 'Movimentação atualizada.' : 'Movimentação lançada.');
    void logActivity({
      action: editing ? 'update' : 'create',
      module: 'financeiro',
      entityType: 'transaction',
      summary: `${editing ? 'Atualizou' : 'Lançou'} ${form.type === 'income' ? 'receita' : 'despesa'} "${payload.description}" (${formatCurrency(payload.amount)})`,
    });
    setModalOpen(false);
    void transactions.refetch();
  };

  const markPaid = async (t: FinancialTransaction) => {
    const { error } = await supabase
      .from('financial_transactions')
      .update({ status: 'paid', paid_at: todayISO() })
      .eq('id', t.id);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    toast.success('Marcado como pago.');
    void logActivity({
      action: 'status_change',
      module: 'financeiro',
      entityType: 'transaction',
      entityId: t.id,
      summary: `Marcou como pago: "${t.description}"`,
    });
    void transactions.refetch();
  };

  const deleteTransaction = async () => {
    if (!deleting) return;
    const { error } = await supabase.from('financial_transactions').delete().eq('id', deleting.id);
    if (error) {
      toast.error(`Erro ao excluir: ${error.message}`);
      return;
    }
    toast.success('Movimentação excluída.');
    void logActivity({
      action: 'delete',
      module: 'financeiro',
      entityType: 'transaction',
      entityId: deleting.id,
      summary: `Excluiu a movimentação "${deleting.description}" (${formatCurrency(deleting.amount)})`,
    });
    setDeleting(null);
    void transactions.refetch();
  };

  const exportCsv = () => {
    exportToCsv(
      `financeiro-${todayISO()}`,
      ['Tipo', 'Descrição', 'Valor', 'Categoria', 'Data', 'Vencimento', 'Pagamento', 'Status', 'Evento', 'Fornecedor'],
      filtered.map((t) => [
        t.type === 'income' ? 'Receita' : 'Despesa',
        t.description,
        Number(t.amount).toFixed(2).replace('.', ','),
        t.category?.name ?? '',
        formatDate(t.date),
        formatDate(t.due_date),
        formatDate(t.paid_at),
        transactionStatusLabels[t.status],
        t.event?.name ?? '',
        t.supplier?.name ?? '',
      ]),
    );
  };

  const saveSupplier = async (e: FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) {
      toast.error('Informe o nome do fornecedor.');
      return;
    }
    const payload = {
      name: supplierForm.name.trim(),
      contact_name: supplierForm.contact_name.trim() || null,
      phone: supplierForm.phone.trim() || null,
      email: supplierForm.email.trim() || null,
      category: supplierForm.category.trim() || null,
      notes: supplierForm.notes.trim() || null,
    };
    const result = editingSupplier
      ? await supabase.from('suppliers').update(payload).eq('id', editingSupplier.id)
      : await supabase.from('suppliers').insert(payload);
    if (result.error) {
      toast.error(`Erro: ${result.error.message}`);
      return;
    }
    toast.success('Fornecedor salvo.');
    setSupplierModal(false);
    void suppliers.refetch();
  };

  const saveCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      toast.error('Informe o nome da categoria.');
      return;
    }
    const { error } = await supabase.from('financial_categories').insert({
      name: categoryForm.name.trim(),
      type: categoryForm.type,
    });
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    toast.success('Categoria criada.');
    setCategoryModal(false);
    setCategoryForm({ name: '', type: 'expense' });
    void categories.refetch();
  };

  const columns: Column<FinancialTransaction>[] = [
    {
      key: 'description',
      header: 'Descrição',
      render: (t) => (
        <span>
          <span className="block font-medium">{t.description}</span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {t.category?.name ?? 'Sem categoria'}
            {t.event?.name ? ` · ${t.event.name}` : ''}
          </span>
        </span>
      ),
    },
    { key: 'date', header: 'Data', render: (t) => formatDate(t.date) },
    { key: 'due', header: 'Vencimento', render: (t) => formatDate(t.due_date), hideOnMobile: true },
    {
      key: 'amount',
      header: 'Valor',
      render: (t) => (
        <span className={t.type === 'income' ? 'font-semibold text-[var(--color-success)]' : 'font-semibold text-[var(--color-danger)]'}>
          {t.type === 'income' ? '+' : '−'} {formatCurrency(t.amount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => <Badge tone={transactionStatusTones[t.status]}>{transactionStatusLabels[t.status]}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (t) =>
        canManage ? (
          <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {t.status === 'pending' && (
              <IconButton label="Marcar como pago" size="sm" onClick={() => void markPaid(t)}>
                <CheckCircle2 size={15} className="text-[var(--color-success)]" />
              </IconButton>
            )}
            {t.receipt_path && (
              <IconButton
                label="Baixar comprovante"
                size="sm"
                onClick={() => void downloadFile('financial-receipts', t.receipt_path!, `comprovante-${t.id}`)}
              >
                <Paperclip size={15} />
              </IconButton>
            )}
            <IconButton label="Editar" size="sm" onClick={() => openEdit(t)}>
              <Pencil size={15} />
            </IconButton>
            <IconButton label="Excluir" size="sm" onClick={() => setDeleting(t)}>
              <Trash2 size={15} className="text-[var(--color-danger)]" />
            </IconButton>
          </span>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Financeiro"
        description="Receitas, despesas, contas e fornecedores da Atlética."
        breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Financeiro' }]}
        actions={
          <>
            <Button variant="outline" icon={<Download size={16} />} onClick={exportCsv}>
              Exportar CSV
            </Button>
            {canManage && (
              <Button icon={<Plus size={16} />} onClick={openCreate}>
                Nova movimentação
              </Button>
            )}
          </>
        }
      />

      <Tabs
        tabs={[
          { id: 'overview', label: 'Visão geral' },
          { id: 'transactions', label: 'Movimentações', count: (transactions.data ?? []).length },
          { id: 'suppliers', label: 'Fornecedores', count: (suppliers.data ?? []).length },
          { id: 'categories', label: 'Categorias', count: (categories.data ?? []).length },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-4"
      />

      {transactions.error ? (
        <ErrorState message={transactions.error} onRetry={() => void transactions.refetch()} />
      ) : tab === 'overview' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <KpiCard
              title="Saldo atual"
              value={formatCurrency(stats.balance)}
              icon={<Wallet size={18} />}
              tone={stats.balance >= 0 ? 'success' : 'danger'}
              loading={transactions.loading}
            />
            <KpiCard title="Receitas pagas" value={formatCurrency(stats.income)} tone="success" loading={transactions.loading} />
            <KpiCard title="Despesas pagas" value={formatCurrency(stats.expense)} tone="danger" loading={transactions.loading} />
            <KpiCard title="Contas pendentes" value={stats.pending} tone="warning" loading={transactions.loading} />
            <KpiCard title="Contas atrasadas" value={stats.overdue} tone={stats.overdue > 0 ? 'danger' : 'default'} loading={transactions.loading} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Evolução mensal" subtitle="Últimos 6 meses" loading={transactions.loading}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} width={70} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="receitas" name="Receitas" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="despesas" name="Despesas" fill="var(--color-danger)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Gastos por categoria" loading={transactions.loading}>
              <div className="h-64">
                {stats.categoryData.length === 0 ? (
                  <EmptyState title="Sem despesas" description="Lance despesas para ver a distribuição por categoria." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.categoryData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={2}
                      >
                        {stats.categoryData.map((entry, i) => (
                          <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </ChartCard>
          </div>
        </div>
      ) : tab === 'transactions' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <SearchInput
              placeholder="Buscar movimentação…"
              aria-label="Buscar movimentação"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              containerClassName="col-span-2 sm:w-60"
            />
            <Select
              aria-label="Filtrar por tipo"
              options={[
                { value: 'income', label: 'Receitas' },
                { value: 'expense', label: 'Despesas' },
              ]}
              placeholder="Tipo"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="sm:w-36"
            />
            <Select
              aria-label="Filtrar por status"
              options={Object.entries(transactionStatusLabels).map(([value, label]) => ({ value, label }))}
              placeholder="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="sm:w-40"
            />
            <Select
              aria-label="Filtrar por categoria"
              options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Categoria"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="sm:w-48"
            />
          </div>
          <Card>
            <DataTable
              columns={columns}
              rows={filtered}
              rowKey={(t) => t.id}
              loading={transactions.loading}
              emptyState={
                <EmptyState
                  icon={<Wallet size={24} />}
                  title="Nenhuma movimentação"
                  description="Lance a primeira receita ou despesa para acompanhar o caixa."
                  actionLabel={canManage ? 'Nova movimentação' : undefined}
                  onAction={canManage ? openCreate : undefined}
                />
              }
            />
          </Card>
        </div>
      ) : tab === 'suppliers' ? (
        <div className="space-y-3">
          {canManage && (
            <Button
              size="sm"
              icon={<Plus size={15} />}
              onClick={() => {
                setEditingSupplier(null);
                setSupplierForm({ name: '', contact_name: '', phone: '', email: '', category: '', notes: '' });
                setSupplierModal(true);
              }}
            >
              Novo fornecedor
            </Button>
          )}
          {(suppliers.data ?? []).length === 0 ? (
            <EmptyState title="Nenhum fornecedor" description="Cadastre fornecedores para vinculá-los às despesas." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(suppliers.data ?? []).map((s) => (
                <Card key={s.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{s.name}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{s.category ?? 'Fornecedor'}</p>
                    </div>
                    {canManage && (
                      <IconButton
                        label="Editar fornecedor"
                        size="sm"
                        onClick={() => {
                          setEditingSupplier(s);
                          setSupplierForm({
                            name: s.name,
                            contact_name: s.contact_name ?? '',
                            phone: s.phone ?? '',
                            email: s.email ?? '',
                            category: s.category ?? '',
                            notes: s.notes ?? '',
                          });
                          setSupplierModal(true);
                        }}
                      >
                        <Pencil size={14} />
                      </IconButton>
                    )}
                  </div>
                  <div className="mt-2 space-y-0.5 text-sm text-[var(--color-text-secondary)]">
                    {s.contact_name && <p>{s.contact_name}</p>}
                    {s.phone && <p>{s.phone}</p>}
                    {s.email && <p className="truncate">{s.email}</p>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {canManage && (
            <Button size="sm" icon={<Plus size={15} />} onClick={() => setCategoryModal(true)}>
              Nova categoria
            </Button>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="p-4">
              <h3 className="mb-2 text-sm font-semibold text-[var(--color-success)]">Receitas</h3>
              <ul className="space-y-1">
                {(categories.data ?? [])
                  .filter((c) => c.type === 'income')
                  .map((c) => (
                    <li key={c.id} className="rounded-lg bg-[var(--color-surface-secondary)] px-3 py-1.5 text-sm">
                      {c.name}
                    </li>
                  ))}
              </ul>
            </Card>
            <Card className="p-4">
              <h3 className="mb-2 text-sm font-semibold text-[var(--color-danger)]">Despesas</h3>
              <ul className="space-y-1">
                {(categories.data ?? [])
                  .filter((c) => c.type === 'expense')
                  .map((c) => (
                    <li key={c.id} className="rounded-lg bg-[var(--color-surface-secondary)] px-3 py-1.5 text-sm">
                      {c.name}
                    </li>
                  ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar movimentação' : 'Nova movimentação'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={(e) => void saveTransaction(e as unknown as FormEvent)}>
              {editing ? 'Salvar alterações' : 'Lançar'}
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => void saveTransaction(e)} className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Tipo"
            options={[
              { value: 'expense', label: 'Despesa' },
              { value: 'income', label: 'Receita' },
            ]}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as TransactionType })}
          />
          <Input
            label="Valor (R$)"
            type="number"
            min={0.01}
            step="0.01"
            required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          <div className="sm:col-span-2">
            <Input
              label="Descrição"
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <Select
            label="Categoria"
            options={(categories.data ?? [])
              .filter((c) => c.type === form.type)
              .map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Selecione…"
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          />
          <Select
            label="Status"
            options={Object.entries(transactionStatusLabels).map(([value, label]) => ({ value, label }))}
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as TransactionStatus })}
          />
          <Input label="Data" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Input label="Vencimento" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          <Input label="Data de pagamento" type="date" value={form.paid_at} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} />
          <Input
            label="Forma de pagamento"
            placeholder="Pix, dinheiro, cartão…"
            value={form.payment_method}
            onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
          />
          <Select
            label="Evento relacionado"
            options={(events.data ?? []).map((ev) => ({ value: ev.id, label: ev.name }))}
            placeholder="Nenhum"
            value={form.event_id}
            onChange={(e) => setForm({ ...form, event_id: e.target.value })}
          />
          <Select
            label="Setor"
            options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
            placeholder="Nenhum"
            value={form.sector_id}
            onChange={(e) => setForm({ ...form, sector_id: e.target.value })}
          />
          <Select
            label="Fornecedor"
            options={(suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            placeholder="Nenhum"
            value={form.supplier_id}
            onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
          />
          <Input
            label="Recorrência"
            placeholder="Ex.: mensal"
            value={form.recurrence}
            onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
          />
          <div className="sm:col-span-2">
            <Textarea label="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-sm font-medium">Comprovante</p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--color-border-strong)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]">
              <Paperclip size={15} aria-hidden />
              {receiptFile ? receiptFile.name : editing?.receipt_path ? 'Substituir comprovante' : 'Anexar comprovante'}
              <input
                type="file"
                accept="image/*,.pdf"
                className="sr-only"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </form>
      </Modal>

      <Modal
        open={supplierModal}
        onClose={() => setSupplierModal(false)}
        title={editingSupplier ? 'Editar fornecedor' : 'Novo fornecedor'}
        footer={
          <>
            <Button variant="outline" onClick={() => setSupplierModal(false)}>
              Cancelar
            </Button>
            <Button onClick={(e) => void saveSupplier(e as unknown as FormEvent)}>Salvar</Button>
          </>
        }
      >
        <form onSubmit={(e) => void saveSupplier(e)} className="grid gap-4">
          <Input label="Nome" required value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} />
          <Input label="Contato" value={supplierForm.contact_name} onChange={(e) => setSupplierForm({ ...supplierForm, contact_name: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Telefone" value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
            <Input label="E-mail" type="email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} />
          </div>
          <Input label="Segmento" value={supplierForm.category} onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })} />
          <Textarea label="Observações" value={supplierForm.notes} onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })} />
        </form>
      </Modal>

      <Modal
        open={categoryModal}
        onClose={() => setCategoryModal(false)}
        title="Nova categoria financeira"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCategoryModal(false)}>
              Cancelar
            </Button>
            <Button onClick={(e) => void saveCategory(e as unknown as FormEvent)}>Criar</Button>
          </>
        }
      >
        <form onSubmit={(e) => void saveCategory(e)} className="grid gap-4">
          <Input label="Nome" required value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} />
          <Select
            label="Tipo"
            options={[
              { value: 'expense', label: 'Despesa' },
              { value: 'income', label: 'Receita' },
            ]}
            value={categoryForm.type}
            onChange={(e) => setCategoryForm({ ...categoryForm, type: e.target.value as TransactionType })}
          />
        </form>
      </Modal>

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={deleteTransaction}
        title="Excluir movimentação"
        message={`Tem certeza que deseja excluir "${deleting?.description ?? ''}"? Esta ação será registrada na auditoria.`}
        confirmLabel="Excluir"
      />
    </div>
  );
}
