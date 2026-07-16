import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users2, CheckSquare, Layers } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useManagement } from '@/contexts/ManagementContext';
import { useToast } from '@/contexts/ToastContext';
import { useQuery } from '@/hooks/useQuery';
import type { Sector } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState } from '@/components/ui/State';
import { sectorTypeLabels } from '@/utils/labels';

interface SectorWithCounts extends Sector {
  memberCount: number;
  openTaskCount: number;
}

export function SectorsPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { currentManagement } = useManagement();
  const toast = useToast();
  const isTop = profile ? ['presidente', 'vice'].includes(profile.role) : false;

  const [createModal, setCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const sectors = useQuery<SectorWithCounts[]>(async () => {
    const { data, error } = await supabase
      .from('sectors')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) throw new Error(error.message);
    const list = (data ?? []) as Sector[];

    const withCounts = await Promise.all(
      list.map(async (s) => {
        const [{ count: memberCount }, { count: openTaskCount }] = await Promise.all([
          supabase.from('sector_members').select('*', { count: 'exact', head: true }).eq('sector_id', s.id),
          supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('sector_id', s.id)
            .eq('is_archived', false)
            .neq('status', 'done')
            .neq('status', 'cancelled'),
        ]);
        return { ...s, memberCount: memberCount ?? 0, openTaskCount: openTaskCount ?? 0 };
      }),
    );
    return withCounts;
  }, [currentManagement?.id]);

  const createSector = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('sectors')
      .insert({ name: name.trim(), management_id: currentManagement?.id ?? null })
      .select('id')
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Setor criado.');
    setCreateModal(false);
    setName('');
    void sectors.refetch();
    if (data) navigate(`/setores/${data.id}`);
  };

  if (sectors.error) {
    return <ErrorState message={sectors.error} onRetry={() => void sectors.refetch()} />;
  }

  return (
    <div>
      <PageHeader
        title="Setores"
        description="Cada setor é um mini-ERP: tarefas, calendário, equipe, metas, eventos e financeiro em um só lugar."
        breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Setores' }]}
        actions={
          isTop && (
            <Button icon={<Plus size={16} />} onClick={() => setCreateModal(true)}>
              Novo setor
            </Button>
          )
        }
      />

      {!sectors.loading && sectors.data && sectors.data.length === 0 ? (
        <EmptyState
          icon={<Layers size={24} />}
          title="Nenhum setor cadastrado"
          description="Crie o primeiro setor para organizar tarefas, eventos e financeiro da Atlética."
          actionLabel={isTop ? 'Novo setor' : undefined}
          onAction={isTop ? () => setCreateModal(true) : undefined}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(sectors.loading ? Array.from({ length: 6 }) : sectors.data ?? []).map((s, i) =>
            s ? (
              <button
                key={(s as SectorWithCounts).id}
                onClick={() => navigate(`/setores/${(s as SectorWithCounts).id}`)}
                className="text-left"
              >
                <Card className="p-4 transition-colors hover:border-[var(--color-primary)]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{(s as SectorWithCounts).name}</p>
                      {(s as SectorWithCounts).description && (
                        <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
                          {(s as SectorWithCounts).description}
                        </p>
                      )}
                    </div>
                    <Badge tone="primary">{sectorTypeLabels[(s as SectorWithCounts).sector_type]}</Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
                    <span className="flex items-center gap-1">
                      <Users2 size={13} aria-hidden /> {(s as SectorWithCounts).memberCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckSquare size={13} aria-hidden /> {(s as SectorWithCounts).openTaskCount} em aberto
                    </span>
                  </div>
                </Card>
              </button>
            ) : (
              <Card key={i} className="h-[104px] animate-shimmer" />
            ),
          )}
        </div>
      )}

      <Modal
        open={createModal}
        onClose={() => setCreateModal(false)}
        title="Novo setor"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateModal(false)}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={() => void createSector()}>
              Criar
            </Button>
          </>
        }
      >
        <Input label="Nome do setor" required value={name} onChange={(e) => setName(e.target.value)} />
      </Modal>
    </div>
  );
}
