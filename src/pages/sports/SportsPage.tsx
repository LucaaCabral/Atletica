import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trophy, Pencil, Users, ClipboardCheck, Swords } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useQuery } from '@/hooks/useQuery';
import { useDebounce } from '@/hooks/useDebounce';
import { logActivity } from '@/services/activityLog';
import type { Athlete, AttendanceStatus, Game, Sport, Training, TrainingAttendance } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Input, Select, SearchInput, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState, ErrorState } from '@/components/ui/State';
import { formatDateTime } from '@/utils/format';
import { cn } from '@/utils/cn';

const attendanceLabels: Record<AttendanceStatus, string> = {
  present: 'Presente',
  absent: 'Ausente',
  justified: 'Justificado',
};

export function SportsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const canManage = can('sports.manage');

  const [tab, setTab] = useState('sports');
  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('');
  const debouncedSearch = useDebounce(search);

  const [sportModal, setSportModal] = useState(false);
  const [editingSport, setEditingSport] = useState<Sport | null>(null);
  const [sportForm, setSportForm] = useState({
    name: '', category: '', gender: '', coach_name: '', training_location: '', schedule: '', status: 'active' as 'active' | 'inactive',
  });

  const [athleteModal, setAthleteModal] = useState(false);
  const [editingAthlete, setEditingAthlete] = useState<Athlete | null>(null);
  const [athleteForm, setAthleteForm] = useState({
    full_name: '', registration: '', course: '', semester: '', phone: '', email: '',
    sport_id: '', position: '', status: 'active' as 'active' | 'inactive', notes: '',
    emergency_name: '', emergency_phone: '', emergency_relationship: '',
  });

  const [trainingModal, setTrainingModal] = useState(false);
  const [trainingForm, setTrainingForm] = useState({ sport_id: '', date: '', location: '', notes: '' });
  const [attendanceTraining, setAttendanceTraining] = useState<Training | null>(null);
  const [attendance, setAttendance] = useState<Map<string, AttendanceStatus>>(new Map());

  const [gameModal, setGameModal] = useState(false);
  const [gameForm, setGameForm] = useState({
    sport_id: '', opponent: '', date: '', location: '', our_score: '', opponent_score: '', notes: '',
  });

  const [saving, setSaving] = useState(false);

  const sports = useQuery<Sport[]>(async () => {
    const { data, error } = await supabase.from('sports').select('*').order('name');
    if (error) throw new Error(error.message);
    return (data ?? []) as Sport[];
  });

  const athletes = useQuery<Athlete[]>(async () => {
    let query = supabase.from('athletes').select('*, sport:sports(id, name)').order('full_name');
    if (debouncedSearch) query = query.ilike('full_name', `%${debouncedSearch}%`);
    if (sportFilter) query = query.eq('sport_id', sportFilter);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as Athlete[];
  }, [debouncedSearch, sportFilter]);

  const trainings = useQuery<Training[]>(async () => {
    const { data } = await supabase
      .from('trainings')
      .select('*, sport:sports(id, name)')
      .order('date', { ascending: false })
      .limit(50);
    return (data ?? []) as Training[];
  });

  const games = useQuery<Game[]>(async () => {
    const { data } = await supabase
      .from('games')
      .select('*, sport:sports(id, name)')
      .order('date', { ascending: false })
      .limit(50);
    return (data ?? []) as Game[];
  });

  const sportOptions = useMemo(
    () => (sports.data ?? []).map((s) => ({ value: s.id, label: s.name })),
    [sports.data],
  );

  const saveSport = async (e: FormEvent) => {
    e.preventDefault();
    if (!sportForm.name.trim()) {
      toast.error('Informe o nome da modalidade.');
      return;
    }
    setSaving(true);
    const payload = {
      name: sportForm.name.trim(),
      category: sportForm.category.trim() || null,
      gender: sportForm.gender.trim() || null,
      coach_name: sportForm.coach_name.trim() || null,
      training_location: sportForm.training_location.trim() || null,
      schedule: sportForm.schedule.trim() || null,
      status: sportForm.status,
    };
    const result = editingSport
      ? await supabase.from('sports').update(payload).eq('id', editingSport.id)
      : await supabase.from('sports').insert(payload);
    setSaving(false);
    if (result.error) {
      toast.error(`Erro: ${result.error.message}`);
      return;
    }
    toast.success('Modalidade salva.');
    setSportModal(false);
    void sports.refetch();
  };

  const openEditAthlete = async (a: Athlete) => {
    setEditingAthlete(a);
    let emergency = { emergency_name: '', emergency_phone: '', emergency_relationship: '' };
    const { data } = await supabase
      .from('athlete_emergency_contacts')
      .select('*')
      .eq('athlete_id', a.id)
      .maybeSingle();
    if (data) {
      emergency = {
        emergency_name: (data.contact_name as string) ?? '',
        emergency_phone: (data.contact_phone as string) ?? '',
        emergency_relationship: (data.relationship as string) ?? '',
      };
    }
    setAthleteForm({
      full_name: a.full_name,
      registration: a.registration ?? '',
      course: a.course ?? '',
      semester: a.semester ?? '',
      phone: a.phone ?? '',
      email: a.email ?? '',
      sport_id: a.sport_id ?? '',
      position: a.position ?? '',
      status: a.status,
      notes: a.notes ?? '',
      ...emergency,
    });
    setAthleteModal(true);
  };

  const saveAthlete = async (e: FormEvent) => {
    e.preventDefault();
    if (!athleteForm.full_name.trim()) {
      toast.error('Informe o nome do atleta.');
      return;
    }
    setSaving(true);
    const payload = {
      full_name: athleteForm.full_name.trim(),
      registration: athleteForm.registration.trim() || null,
      course: athleteForm.course.trim() || null,
      semester: athleteForm.semester.trim() || null,
      phone: athleteForm.phone.trim() || null,
      email: athleteForm.email.trim() || null,
      sport_id: athleteForm.sport_id || null,
      position: athleteForm.position.trim() || null,
      status: athleteForm.status,
      notes: athleteForm.notes.trim() || null,
    };

    let athleteId = editingAthlete?.id ?? null;
    if (editingAthlete) {
      const { error } = await supabase.from('athletes').update(payload).eq('id', editingAthlete.id);
      if (error) {
        setSaving(false);
        toast.error(`Erro: ${error.message}`);
        return;
      }
    } else {
      const { data, error } = await supabase.from('athletes').insert(payload).select('id').single();
      if (error || !data) {
        setSaving(false);
        toast.error(`Erro: ${error?.message ?? 'desconhecido'}`);
        return;
      }
      athleteId = data.id as string;
    }

    if (athleteId && athleteForm.emergency_name.trim() && athleteForm.emergency_phone.trim()) {
      await supabase.from('athlete_emergency_contacts').upsert({
        athlete_id: athleteId,
        contact_name: athleteForm.emergency_name.trim(),
        contact_phone: athleteForm.emergency_phone.trim(),
        relationship: athleteForm.emergency_relationship.trim() || null,
      });
    }

    setSaving(false);
    toast.success('Atleta salvo.');
    void logActivity({
      action: editingAthlete ? 'update' : 'create',
      module: 'esportes',
      entityType: 'athlete',
      entityId: athleteId ?? undefined,
      summary: `${editingAthlete ? 'Atualizou' : 'Cadastrou'} o atleta ${payload.full_name}`,
    });
    setAthleteModal(false);
    void athletes.refetch();
  };

  const saveTraining = async (e: FormEvent) => {
    e.preventDefault();
    if (!trainingForm.sport_id || !trainingForm.date) {
      toast.error('Informe a modalidade e a data do treino.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('trainings').insert({
      sport_id: trainingForm.sport_id,
      date: new Date(trainingForm.date).toISOString(),
      location: trainingForm.location.trim() || null,
      notes: trainingForm.notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    toast.success('Treino registrado.');
    setTrainingModal(false);
    setTrainingForm({ sport_id: '', date: '', location: '', notes: '' });
    void trainings.refetch();
  };

  const openAttendance = async (training: Training) => {
    setAttendanceTraining(training);
    const { data } = await supabase
      .from('training_attendance')
      .select('*')
      .eq('training_id', training.id);
    const map = new Map<string, AttendanceStatus>();
    for (const row of (data ?? []) as TrainingAttendance[]) {
      map.set(row.athlete_id, row.status);
    }
    setAttendance(map);
  };

  const setAthleteAttendance = async (athleteId: string, status: AttendanceStatus) => {
    if (!attendanceTraining) return;
    setAttendance((prev) => new Map(prev).set(athleteId, status));
    await supabase.from('training_attendance').upsert({
      training_id: attendanceTraining.id,
      athlete_id: athleteId,
      status,
    });
  };

  const saveGame = async (e: FormEvent) => {
    e.preventDefault();
    if (!gameForm.sport_id || !gameForm.date) {
      toast.error('Informe a modalidade e a data do jogo.');
      return;
    }
    setSaving(true);
    const our = gameForm.our_score === '' ? null : Number(gameForm.our_score);
    const theirs = gameForm.opponent_score === '' ? null : Number(gameForm.opponent_score);
    let result: 'win' | 'loss' | 'draw' | null = null;
    if (our !== null && theirs !== null) {
      result = our > theirs ? 'win' : our < theirs ? 'loss' : 'draw';
    }
    const { error } = await supabase.from('games').insert({
      sport_id: gameForm.sport_id,
      opponent: gameForm.opponent.trim() || null,
      date: new Date(gameForm.date).toISOString(),
      location: gameForm.location.trim() || null,
      our_score: our,
      opponent_score: theirs,
      result,
      notes: gameForm.notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    toast.success('Jogo registrado.');
    setGameModal(false);
    setGameForm({ sport_id: '', opponent: '', date: '', location: '', our_score: '', opponent_score: '', notes: '' });
    void games.refetch();
  };

  const athleteColumns: Column<Athlete>[] = [
    {
      key: 'name',
      header: 'Atleta',
      render: (a) => (
        <span className="flex items-center gap-2">
          <Avatar name={a.full_name} src={a.photo_url} size="sm" />
          <span>
            <span className="block font-medium">{a.full_name}</span>
            <span className="text-xs text-[var(--color-text-muted)]">{a.course ?? '—'}</span>
          </span>
        </span>
      ),
    },
    { key: 'sport', header: 'Modalidade', render: (a) => a.sport?.name ?? '—' },
    { key: 'position', header: 'Posição', render: (a) => a.position ?? '—', hideOnMobile: true },
    { key: 'registration', header: 'Matrícula', render: (a) => a.registration ?? '—', hideOnMobile: true },
    {
      key: 'status',
      header: 'Status',
      render: (a) => (
        <Badge tone={a.status === 'active' ? 'success' : 'neutral'}>{a.status === 'active' ? 'Ativo' : 'Inativo'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (a) =>
        canManage ? (
          <span onClick={(e) => e.stopPropagation()}>
            <IconButton label={`Editar ${a.full_name}`} size="sm" onClick={() => void openEditAthlete(a)}>
              <Pencil size={15} />
            </IconButton>
          </span>
        ) : null,
    },
  ];

  const attendanceAthletes = useMemo(
    () => (athletes.data ?? []).filter((a) => !attendanceTraining || a.sport_id === attendanceTraining.sport_id),
    [athletes.data, attendanceTraining],
  );

  return (
    <div>
      <PageHeader
        title="Esportes"
        description="Modalidades, atletas, treinos, presença e jogos."
        breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Esportes' }]}
      />

      <Tabs
        tabs={[
          { id: 'sports', label: 'Modalidades', count: (sports.data ?? []).length },
          { id: 'athletes', label: 'Atletas', count: (athletes.data ?? []).length },
          { id: 'trainings', label: 'Treinos', count: (trainings.data ?? []).length },
          { id: 'games', label: 'Jogos', count: (games.data ?? []).length },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-4"
      />

      {sports.error ? (
        <ErrorState message={sports.error} onRetry={() => void sports.refetch()} />
      ) : tab === 'sports' ? (
        <div className="space-y-3">
          {canManage && (
            <Button
              size="sm"
              icon={<Plus size={15} />}
              onClick={() => {
                setEditingSport(null);
                setSportForm({ name: '', category: '', gender: '', coach_name: '', training_location: '', schedule: '', status: 'active' });
                setSportModal(true);
              }}
            >
              Nova modalidade
            </Button>
          )}
          {(sports.data ?? []).length === 0 ? (
            <EmptyState
              icon={<Trophy size={24} />}
              title="Nenhuma modalidade cadastrada"
              description="Cadastre modalidades como futsal, vôlei e basquete para organizar treinos e atletas."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(sports.data ?? []).map((s) => (
                <Card key={s.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {[s.category, s.gender].filter(Boolean).join(' · ') || 'Modalidade'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge tone={s.status === 'active' ? 'success' : 'neutral'}>
                        {s.status === 'active' ? 'Ativa' : 'Inativa'}
                      </Badge>
                      {canManage && (
                        <IconButton
                          label="Editar modalidade"
                          size="sm"
                          onClick={() => {
                            setEditingSport(s);
                            setSportForm({
                              name: s.name,
                              category: s.category ?? '',
                              gender: s.gender ?? '',
                              coach_name: s.coach_name ?? '',
                              training_location: s.training_location ?? '',
                              schedule: s.schedule ?? '',
                              status: s.status,
                            });
                            setSportModal(true);
                          }}
                        >
                          <Pencil size={14} />
                        </IconButton>
                      )}
                    </div>
                  </div>
                  <dl className="mt-3 space-y-1 text-sm text-[var(--color-text-secondary)]">
                    {s.coach_name && <dd>Treinador: {s.coach_name}</dd>}
                    {s.training_location && <dd>Local: {s.training_location}</dd>}
                    {s.schedule && <dd>Horários: {s.schedule}</dd>}
                  </dl>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : tab === 'athletes' ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput
              placeholder="Buscar atleta…"
              aria-label="Buscar atleta"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              containerClassName="flex-1"
            />
            <Select
              aria-label="Filtrar por modalidade"
              options={sportOptions}
              placeholder="Todas as modalidades"
              value={sportFilter}
              onChange={(e) => setSportFilter(e.target.value)}
              className="sm:w-52"
            />
            {canManage && (
              <Button
                icon={<Plus size={16} />}
                onClick={() => {
                  setEditingAthlete(null);
                  setAthleteForm({
                    full_name: '', registration: '', course: '', semester: '', phone: '', email: '',
                    sport_id: '', position: '', status: 'active', notes: '',
                    emergency_name: '', emergency_phone: '', emergency_relationship: '',
                  });
                  setAthleteModal(true);
                }}
              >
                Novo atleta
              </Button>
            )}
          </div>
          <Card>
            <DataTable
              columns={athleteColumns}
              rows={athletes.data ?? []}
              rowKey={(a) => a.id}
              loading={athletes.loading}
              onRowClick={(a) => navigate(`/esportes/atletas/${a.id}`)}
              emptyState={
                <EmptyState
                  icon={<Users size={24} />}
                  title="Nenhum atleta cadastrado"
                  description="Cadastre os atletas das modalidades para controlar presença e jogos."
                />
              }
            />
          </Card>
        </div>
      ) : tab === 'trainings' ? (
        <div className="space-y-3">
          {canManage && (
            <Button size="sm" icon={<Plus size={15} />} onClick={() => setTrainingModal(true)}>
              Registrar treino
            </Button>
          )}
          {(trainings.data ?? []).length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck size={24} />}
              title="Nenhum treino registrado"
              description="Registre treinos para controlar a frequência dos atletas."
            />
          ) : (
            <Card>
              <ul className="divide-y divide-[var(--color-border)]">
                {(trainings.data ?? []).map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => void openAttendance(t)}
                      className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-[var(--color-surface-hover)]"
                    >
                      <span>
                        <span className="block text-sm font-medium">{t.sport?.name ?? 'Treino'}</span>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {formatDateTime(t.date)}
                          {t.location ? ` · ${t.location}` : ''}
                        </span>
                      </span>
                      <Badge tone="info">Chamada</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {canManage && (
            <Button size="sm" icon={<Plus size={15} />} onClick={() => setGameModal(true)}>
              Registrar jogo
            </Button>
          )}
          {(games.data ?? []).length === 0 ? (
            <EmptyState
              icon={<Swords size={24} />}
              title="Nenhum jogo registrado"
              description="Registre jogos e resultados das modalidades."
            />
          ) : (
            <Card>
              <ul className="divide-y divide-[var(--color-border)]">
                {(games.data ?? []).map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-2 px-4 py-3">
                    <span>
                      <span className="block text-sm font-medium">
                        {g.sport?.name ?? 'Jogo'} × {g.opponent ?? 'Adversário'}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {formatDateTime(g.date)}
                        {g.location ? ` · ${g.location}` : ''}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {g.our_score !== null && g.opponent_score !== null && (
                        <span className="font-mono text-sm font-semibold">
                          {g.our_score} × {g.opponent_score}
                        </span>
                      )}
                      {g.result && (
                        <Badge tone={g.result === 'win' ? 'success' : g.result === 'loss' ? 'danger' : 'neutral'}>
                          {g.result === 'win' ? 'Vitória' : g.result === 'loss' ? 'Derrota' : 'Empate'}
                        </Badge>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <Modal
        open={sportModal}
        onClose={() => setSportModal(false)}
        title={editingSport ? 'Editar modalidade' : 'Nova modalidade'}
        footer={
          <>
            <Button variant="outline" onClick={() => setSportModal(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={(e) => void saveSport(e as unknown as FormEvent)}>
              Salvar
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => void saveSport(e)} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input label="Nome" required value={sportForm.name} onChange={(e) => setSportForm({ ...sportForm, name: e.target.value })} />
          </div>
          <Input label="Categoria" placeholder="Quadra, campo, eletrônico…" value={sportForm.category} onChange={(e) => setSportForm({ ...sportForm, category: e.target.value })} />
          <Input label="Gênero / formato" placeholder="Masculino, feminino, misto…" value={sportForm.gender} onChange={(e) => setSportForm({ ...sportForm, gender: e.target.value })} />
          <Input label="Treinador" value={sportForm.coach_name} onChange={(e) => setSportForm({ ...sportForm, coach_name: e.target.value })} />
          <Input label="Local dos treinos" value={sportForm.training_location} onChange={(e) => setSportForm({ ...sportForm, training_location: e.target.value })} />
          <Input label="Dias e horários" placeholder="Ter/Qui 20h" value={sportForm.schedule} onChange={(e) => setSportForm({ ...sportForm, schedule: e.target.value })} />
          <Select
            label="Status"
            options={[
              { value: 'active', label: 'Ativa' },
              { value: 'inactive', label: 'Inativa' },
            ]}
            value={sportForm.status}
            onChange={(e) => setSportForm({ ...sportForm, status: e.target.value as 'active' | 'inactive' })}
          />
        </form>
      </Modal>

      <Modal
        open={athleteModal}
        onClose={() => setAthleteModal(false)}
        title={editingAthlete ? 'Editar atleta' : 'Novo atleta'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setAthleteModal(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={(e) => void saveAthlete(e as unknown as FormEvent)}>
              Salvar
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => void saveAthlete(e)} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input label="Nome completo" required value={athleteForm.full_name} onChange={(e) => setAthleteForm({ ...athleteForm, full_name: e.target.value })} />
          </div>
          <Input label="Matrícula" value={athleteForm.registration} onChange={(e) => setAthleteForm({ ...athleteForm, registration: e.target.value })} />
          <Input label="Curso" value={athleteForm.course} onChange={(e) => setAthleteForm({ ...athleteForm, course: e.target.value })} />
          <Input label="Período" value={athleteForm.semester} onChange={(e) => setAthleteForm({ ...athleteForm, semester: e.target.value })} />
          <Input label="Telefone" value={athleteForm.phone} onChange={(e) => setAthleteForm({ ...athleteForm, phone: e.target.value })} />
          <Input label="E-mail" type="email" value={athleteForm.email} onChange={(e) => setAthleteForm({ ...athleteForm, email: e.target.value })} />
          <Select
            label="Modalidade"
            options={sportOptions}
            placeholder="Selecione…"
            value={athleteForm.sport_id}
            onChange={(e) => setAthleteForm({ ...athleteForm, sport_id: e.target.value })}
          />
          <Input label="Posição" value={athleteForm.position} onChange={(e) => setAthleteForm({ ...athleteForm, position: e.target.value })} />
          <Select
            label="Status"
            options={[
              { value: 'active', label: 'Ativo' },
              { value: 'inactive', label: 'Inativo' },
            ]}
            value={athleteForm.status}
            onChange={(e) => setAthleteForm({ ...athleteForm, status: e.target.value as 'active' | 'inactive' })}
          />
          <div className="sm:col-span-2">
            <Textarea label="Observações" value={athleteForm.notes} onChange={(e) => setAthleteForm({ ...athleteForm, notes: e.target.value })} />
          </div>
          <div className="sm:col-span-2 rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-3">
            <p className="mb-2 text-sm font-medium">Contato de emergência (acesso restrito)</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input label="Nome" value={athleteForm.emergency_name} onChange={(e) => setAthleteForm({ ...athleteForm, emergency_name: e.target.value })} />
              <Input label="Telefone" value={athleteForm.emergency_phone} onChange={(e) => setAthleteForm({ ...athleteForm, emergency_phone: e.target.value })} />
              <Input label="Parentesco" value={athleteForm.emergency_relationship} onChange={(e) => setAthleteForm({ ...athleteForm, emergency_relationship: e.target.value })} />
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={trainingModal}
        onClose={() => setTrainingModal(false)}
        title="Registrar treino"
        footer={
          <>
            <Button variant="outline" onClick={() => setTrainingModal(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={(e) => void saveTraining(e as unknown as FormEvent)}>
              Registrar
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => void saveTraining(e)} className="grid gap-4">
          <Select
            label="Modalidade"
            required
            options={sportOptions}
            placeholder="Selecione…"
            value={trainingForm.sport_id}
            onChange={(e) => setTrainingForm({ ...trainingForm, sport_id: e.target.value })}
          />
          <Input
            label="Data e hora"
            type="datetime-local"
            required
            value={trainingForm.date}
            onChange={(e) => setTrainingForm({ ...trainingForm, date: e.target.value })}
          />
          <Input label="Local" value={trainingForm.location} onChange={(e) => setTrainingForm({ ...trainingForm, location: e.target.value })} />
          <Textarea label="Observações" value={trainingForm.notes} onChange={(e) => setTrainingForm({ ...trainingForm, notes: e.target.value })} />
        </form>
      </Modal>

      <Modal
        open={attendanceTraining !== null}
        onClose={() => setAttendanceTraining(null)}
        title={`Chamada — ${attendanceTraining?.sport?.name ?? ''} (${attendanceTraining ? formatDateTime(attendanceTraining.date) : ''})`}
        size="lg"
      >
        {attendanceAthletes.length === 0 ? (
          <EmptyState title="Sem atletas" description="Cadastre atletas nesta modalidade para registrar presença." />
        ) : (
          <ul className="space-y-2">
            {attendanceAthletes.map((a) => {
              const current = attendance.get(a.id);
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2">
                  <Avatar name={a.full_name} src={a.photo_url} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.full_name}</span>
                  <div className="flex gap-1">
                    {(Object.keys(attendanceLabels) as AttendanceStatus[]).map((status) => (
                      <button
                        key={status}
                        onClick={() => void setAthleteAttendance(a.id, status)}
                        disabled={!canManage}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs transition-colors',
                          current === status
                            ? status === 'present'
                              ? 'border-[var(--color-success)] bg-[var(--color-success-soft)] text-[var(--color-success)]'
                              : status === 'absent'
                                ? 'border-[var(--color-danger)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
                                : 'border-[var(--color-warning)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]'
                            : 'border-[var(--color-border)] text-[var(--color-text-secondary)]',
                        )}
                      >
                        {attendanceLabels[status]}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      <Modal
        open={gameModal}
        onClose={() => setGameModal(false)}
        title="Registrar jogo"
        footer={
          <>
            <Button variant="outline" onClick={() => setGameModal(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={(e) => void saveGame(e as unknown as FormEvent)}>
              Registrar
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => void saveGame(e)} className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Modalidade"
            required
            options={sportOptions}
            placeholder="Selecione…"
            value={gameForm.sport_id}
            onChange={(e) => setGameForm({ ...gameForm, sport_id: e.target.value })}
          />
          <Input label="Adversário" value={gameForm.opponent} onChange={(e) => setGameForm({ ...gameForm, opponent: e.target.value })} />
          <Input
            label="Data e hora"
            type="datetime-local"
            required
            value={gameForm.date}
            onChange={(e) => setGameForm({ ...gameForm, date: e.target.value })}
          />
          <Input label="Local" value={gameForm.location} onChange={(e) => setGameForm({ ...gameForm, location: e.target.value })} />
          <Input label="Nossos pontos" type="number" min={0} value={gameForm.our_score} onChange={(e) => setGameForm({ ...gameForm, our_score: e.target.value })} />
          <Input label="Pontos do adversário" type="number" min={0} value={gameForm.opponent_score} onChange={(e) => setGameForm({ ...gameForm, opponent_score: e.target.value })} />
          <div className="sm:col-span-2">
            <Textarea label="Observações" value={gameForm.notes} onChange={(e) => setGameForm({ ...gameForm, notes: e.target.value })} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
