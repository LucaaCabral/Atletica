import { useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Handshake, Pencil, Trash2, Globe, Mail, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useQuery } from '@/hooks/useQuery';
import { logActivity } from '@/services/activityLog';
import type { Sponsor, SponsorStatus } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/State';
import { sponsorStatusLabels, sponsorStatusOrder } from '@/utils/labels';
import { formatCurrency, formatDate } from '@/utils/format';

interface SponsorForm {
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  website: string;
  segment: string;
  status: SponsorStatus;
  value: string;
  partnership_type: string;
  start_date: string;
  end_date: string;
  deliverables: string;
  counterparts: string;
  notes: string;
}

const emptyForm: SponsorForm = {
  company_name: '', contact_name: '', phone: '', email: '', website: '', segment: '',
  status: 'prospecting', value: '', partnership_type: '', start_date: '', end_date: '',
  deliverables: '', counterparts: '', notes: '',
};

export function SponsorsPage() {
  const { profile, can } = useAuth();
  const toast = useToast();
  const canManage = can('sponsors.manage');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Sponsor | null>(null);
  const [form, setForm] = useState<SponsorForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Sponsor | null>(null);

  const sponsors = useQuery<Sponsor[]>(async () => {
    const { data, error } = await supabase.from('sponsors').select('*').order('company_name');
    if (error) throw new Error(error.message);
    return (data ?? []) as Sponsor[];
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (s: Sponsor) => {
    setEditing(s);
    setForm({
      company_name: s.company_name,
      contact_name: s.contact_name ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      website: s.website ?? '',
      segment: s.segment ?? '',
      status: s.status,
      value: s.value?.toString() ?? '',
      partnership_type: s.partnership_type ?? '',
      start_date: s.start_date ?? '',
      end_date: s.end_date ?? '',
      deliverables: s.deliverables ?? '',
      counterparts: s.counterparts ?? '',
      notes: s.notes ?? '',
    });
    setModalOpen(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.company_name.trim()) {
      toast.error('Informe o nome da empresa.');
      return;
    }
    setSaving(true);
    const payload = {
      company_name: form.company_name.trim(),
      contact_name: form.contact_name.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      website: form.website.trim() || null,
      segment: form.segment.trim() || null,
      status: form.status,
      value: form.value ? Number(form.value) : null,
      partnership_type: form.partnership_type.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      deliverables: form.deliverables.trim() || null,
      counterparts: form.counterparts.trim() || null,
      notes: form.notes.trim() || null,
    };
    const result = editing
      ? await supabase.from('sponsors').update(payload).eq('id', editing.id)
      : await supabase.from('sponsors').insert({ ...payload, created_by: profile?.id ?? null });
    setSaving(false);
    if (result.error) {
      toast.error(`Erro: ${result.error.message}`);
      return;
    }
    toast.success('Patrocinador salvo.');
    void logActivity({
      action: editing ? 'update' : 'create',
      module: 'patrocinadores',
      entityType: 'sponsor',
      summary: `${editing ? 'Atualizou' : 'Cadastrou'} o patrocinador ${payload.company_name}`,
    });
    setModalOpen(false);
    void sponsors.refetch();
  };

  const moveStatus = async (sponsor: Sponsor, status: SponsorStatus) => {
    const { error } = await supabase.from('sponsors').update({ status }).eq('id', sponsor.id);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    void sponsors.refetch();
  };

  const remove = async () => {
    if (!deleting) return;
    const { error } = await supabase.from('sponsors').delete().eq('id', deleting.id);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    toast.success('Patrocinador excluído.');
    setDeleting(null);
    void sponsors.refetch();
  };

  return (
    <div>
      <PageHeader
        title="Patrocinadores"
        description="Pipeline de parcerias e patrocinadores da Atlética."
        breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Patrocinadores' }]}
        actions={
          canManage && (
            <Button icon={<Plus size={16} />} onClick={openCreate}>
              Novo patrocinador
            </Button>
          )
        }
      />

      {sponsors.error ? (
        <ErrorState message={sponsors.error} onRetry={() => void sponsors.refetch()} />
      ) : sponsors.loading ? (
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-64" />
          ))}
        </div>
      ) : (sponsors.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Handshake size={24} />}
          title="Nenhum patrocinador cadastrado"
          description="Cadastre empresas parceiras e acompanhe a negociação no pipeline."
          actionLabel={canManage ? 'Cadastrar patrocinador' : undefined}
          onAction={canManage ? openCreate : undefined}
        />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {sponsorStatusOrder.map((status) => {
            const items = (sponsors.data ?? []).filter((s) => s.status === status);
            return (
              <div key={status} className="w-64 shrink-0 rounded-xl bg-[var(--color-surface-secondary)] sm:w-72">
                <div className="flex items-center justify-between px-3 py-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                    {sponsorStatusLabels[status]}
                  </h3>
                  <span className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-xs font-medium">{items.length}</span>
                </div>
                <div className="flex flex-col gap-2 px-2 pb-2" style={{ maxHeight: '62dvh', overflowY: 'auto' }}>
                  {items.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-sm font-semibold leading-snug">{s.company_name}</p>
                        {canManage && (
                          <div className="flex">
                            <IconButton label="Editar" size="sm" onClick={() => openEdit(s)}>
                              <Pencil size={13} />
                            </IconButton>
                            <IconButton label="Excluir" size="sm" onClick={() => setDeleting(s)}>
                              <Trash2 size={13} className="text-[var(--color-danger)]" />
                            </IconButton>
                          </div>
                        )}
                      </div>
                      {s.segment && <p className="text-xs text-[var(--color-text-muted)]">{s.segment}</p>}
                      {s.value !== null && s.value !== undefined && s.value > 0 && (
                        <p className="mt-1 text-sm font-semibold text-[var(--color-success)]">{formatCurrency(s.value)}</p>
                      )}
                      <div className="mt-1.5 space-y-0.5 text-xs text-[var(--color-text-secondary)]">
                        {s.contact_name && <p>{s.contact_name}</p>}
                        {s.phone && (
                          <p className="flex items-center gap-1">
                            <Phone size={10} aria-hidden />
                            {s.phone}
                          </p>
                        )}
                        {s.email && (
                          <p className="flex items-center gap-1 truncate">
                            <Mail size={10} aria-hidden />
                            {s.email}
                          </p>
                        )}
                        {s.website && (
                          <p className="flex items-center gap-1 truncate">
                            <Globe size={10} aria-hidden />
                            {s.website}
                          </p>
                        )}
                        {s.end_date && <p>Vigência até {formatDate(s.end_date)}</p>}
                      </div>
                      {canManage && (
                        <select
                          aria-label={`Mover ${s.company_name} de etapa`}
                          value={s.status}
                          onChange={(e) => void moveStatus(s, e.target.value as SponsorStatus)}
                          className="mt-2 h-8 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs"
                        >
                          {sponsorStatusOrder.map((st) => (
                            <option key={st} value={st}>
                              {sponsorStatusLabels[st]}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p className="px-2 py-3 text-center text-xs text-[var(--color-text-muted)]">Vazio</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar patrocinador' : 'Novo patrocinador'}
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
            <Input label="Empresa" required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          </div>
          <Input label="Contato principal" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
          <Input label="Segmento" value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} />
          <Input label="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Site" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          <Select
            label="Etapa do pipeline"
            options={sponsorStatusOrder.map((s) => ({ value: s, label: sponsorStatusLabels[s] }))}
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as SponsorStatus })}
          />
          <Input
            label="Valor (R$)"
            type="number"
            min={0}
            step="0.01"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
          />
          <Input label="Tipo de parceria" placeholder="Financeira, permuta…" value={form.partnership_type} onChange={(e) => setForm({ ...form, partnership_type: e.target.value })} />
          <Input label="Início" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          <Input label="Término" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          <div className="sm:col-span-2">
            <Textarea label="Entregas prometidas" value={form.deliverables} onChange={(e) => setForm({ ...form, deliverables: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Textarea label="Contrapartidas" value={form.counterparts} onChange={(e) => setForm({ ...form, counterparts: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Textarea label="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Excluir patrocinador"
        message={`Tem certeza que deseja excluir "${deleting?.company_name ?? ''}"?`}
        confirmLabel="Excluir"
      />
    </div>
  );
}
