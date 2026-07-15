import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, List, MapPin, Plus, PartyPopper, CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useQuery } from '@/hooks/useQuery';
import { useDebounce } from '@/hooks/useDebounce';
import { logActivity } from '@/services/activityLog';
import type { Event, EventStatus, Profile } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Input, Select, SearchInput, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge, eventStatusTones } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/State';
import { eventStatusLabels } from '@/utils/labels';
import { formatCurrency, formatDate } from '@/utils/format';

interface EventForm {
  name: string;
  description: string;
  category: string;
  status: EventStatus;
  start_date: string;
  end_date: string;
  location: string;
  address: string;
  expected_attendance: string;
  budget: string;
  responsible_id: string;
  notes: string;
}

const emptyForm: EventForm = {
  name: '',
  description: '',
  category: '',
  status: 'planning',
  start_date: '',
  end_date: '',
  location: '',
  address: '',
  expected_attendance: '',
  budget: '',
  responsible_id: '',
  notes: '',
};

export function EventsPage() {
  const navigate = useNavigate();
  const { profile, can } = useAuth();
  const { eventCategories } = useSettings();
  const toast = useToast();
  const canManage = can('events.manage');

  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const debouncedSearch = useDebounce(search);

  const profiles = useQuery<Profile[]>(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('is_active', true).order('full_name');
    return (data ?? []) as Profile[];
  });

  const events = useQuery<Event[]>(async () => {
    let query = supabase
      .from('events')
      .select('*, responsible:profiles(id, full_name, avatar_url)')
      .order('start_date', { ascending: false, nullsFirst: false });
    if (debouncedSearch) query = query.ilike('name', `%${debouncedSearch}%`);
    if (statusFilter) query = query.eq('status', statusFilter as EventStatus);
    if (categoryFilter) query = query.eq('category', categoryFilter);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as Event[];
  }, [debouncedSearch, statusFilter, categoryFilter]);

  const categoryOptions = useMemo(
    () => eventCategories.map((c) => ({ value: c, label: c })),
    [eventCategories],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (form.name.trim().length < 3) {
      toast.error('Informe o nome do evento.');
      return;
    }
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      toast.error('A data final não pode ser anterior à data inicial.');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category || null,
      status: form.status,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      location: form.location.trim() || null,
      address: form.address.trim() || null,
      expected_attendance: form.expected_attendance ? Number(form.expected_attendance) : null,
      budget: form.budget ? Number(form.budget) : null,
      responsible_id: form.responsible_id || null,
      notes: form.notes.trim() || null,
    };

    const result = editing
      ? await supabase.from('events').update(payload).eq('id', editing.id)
      : await supabase.from('events').insert({ ...payload, created_by: profile?.id ?? null });

    setSaving(false);
    if (result.error) {
      toast.error(`Erro ao salvar: ${result.error.message}`);
      return;
    }
    toast.success(editing ? 'Evento atualizado.' : 'Evento criado.');
    void logActivity({
      action: editing ? 'update' : 'create',
      module: 'eventos',
      entityType: 'event',
      summary: `${editing ? 'Atualizou' : 'Criou'} o evento ${payload.name}`,
    });
    setModalOpen(false);
    void events.refetch();
  };

  const columns: Column<Event>[] = [
    {
      key: 'name',
      header: 'Evento',
      render: (ev) => (
        <span>
          <span className="block font-medium">{ev.name}</span>
          {ev.category && <span className="text-xs text-[var(--color-text-muted)]">{ev.category}</span>}
        </span>
      ),
    },
    { key: 'date', header: 'Data', render: (ev) => formatDate(ev.start_date) },
    { key: 'location', header: 'Local', render: (ev) => ev.location ?? '—', hideOnMobile: true },
    {
      key: 'responsible',
      header: 'Responsável',
      render: (ev) => ev.responsible?.full_name ?? '—',
      hideOnMobile: true,
    },
    { key: 'budget', header: 'Orçamento', render: (ev) => (ev.budget ? formatCurrency(ev.budget) : '—'), hideOnMobile: true },
    {
      key: 'status',
      header: 'Status',
      render: (ev) => <Badge tone={eventStatusTones[ev.status]}>{eventStatusLabels[ev.status]}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Eventos"
        description="Planejamento e acompanhamento de todos os eventos da Atlética."
        breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Eventos' }]}
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
                Novo evento
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput
          placeholder="Buscar evento…"
          aria-label="Buscar evento"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          containerClassName="flex-1"
        />
        <Select
          aria-label="Filtrar por status"
          options={Object.entries(eventStatusLabels).map(([value, label]) => ({ value, label }))}
          placeholder="Todos os status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="sm:w-48"
        />
        <Select
          aria-label="Filtrar por categoria"
          options={categoryOptions}
          placeholder="Todas as categorias"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="sm:w-48"
        />
      </div>

      {events.error ? (
        <ErrorState message={events.error} onRetry={() => void events.refetch()} />
      ) : view === 'cards' ? (
        events.loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : (events.data ?? []).length === 0 ? (
          <EmptyState
            icon={<PartyPopper size={24} />}
            title="Você ainda não possui eventos cadastrados"
            description="Crie o primeiro evento para começar a organizar sua Atlética."
            actionLabel={canManage ? 'Criar evento' : undefined}
            onAction={canManage ? openCreate : undefined}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(events.data ?? []).map((ev) => (
              <Card
                key={ev.id}
                className="cursor-pointer overflow-hidden transition-colors hover:border-[var(--color-primary)]"
                onClick={() => navigate(`/eventos/${ev.id}`)}
              >
                <div className="flex h-20 items-center justify-center bg-[var(--color-primary-soft)]">
                  {ev.cover_url ? (
                    <img src={ev.cover_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <PartyPopper size={28} className="text-[var(--color-primary)]" aria-hidden />
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-snug">{ev.name}</p>
                    <Badge tone={eventStatusTones[ev.status]}>{eventStatusLabels[ev.status]}</Badge>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-[var(--color-text-secondary)]">
                    <p className="flex items-center gap-1.5">
                      <CalendarDays size={12} aria-hidden />
                      {formatDate(ev.start_date)}
                      {ev.end_date && ev.end_date !== ev.start_date && ` — ${formatDate(ev.end_date)}`}
                    </p>
                    {ev.location && (
                      <p className="flex items-center gap-1.5">
                        <MapPin size={12} aria-hidden />
                        {ev.location}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card>
          <DataTable
            columns={columns}
            rows={events.data ?? []}
            rowKey={(ev) => ev.id}
            loading={events.loading}
            onRowClick={(ev) => navigate(`/eventos/${ev.id}`)}
            emptyState={<EmptyState title="Nenhum evento encontrado" description="Ajuste os filtros ou crie um novo evento." />}
          />
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar evento' : 'Novo evento'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={(e) => void onSubmit(e as unknown as FormEvent)}>
              {editing ? 'Salvar alterações' : 'Criar evento'}
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input label="Nome do evento" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <Select
            label="Categoria"
            options={categoryOptions}
            placeholder="Selecione…"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <Select
            label="Status"
            options={Object.entries(eventStatusLabels).map(([value, label]) => ({ value, label }))}
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as EventStatus })}
          />
          <Input label="Data inicial" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          <Input label="Data final" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          <Input label="Local" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <Input label="Endereço" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Input
            label="Público esperado"
            type="number"
            min={0}
            value={form.expected_attendance}
            onChange={(e) => setForm({ ...form, expected_attendance: e.target.value })}
          />
          <Input
            label="Orçamento (R$)"
            type="number"
            min={0}
            step="0.01"
            value={form.budget}
            onChange={(e) => setForm({ ...form, budget: e.target.value })}
          />
          <Select
            label="Responsável"
            options={(profiles.data ?? []).map((p) => ({ value: p.id, label: p.full_name }))}
            placeholder="Selecione…"
            value={form.responsible_id}
            onChange={(e) => setForm({ ...form, responsible_id: e.target.value })}
          />
          <div className="sm:col-span-2">
            <Textarea label="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Textarea label="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
