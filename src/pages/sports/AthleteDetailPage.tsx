import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Mail, Phone, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@/hooks/useQuery';
import type { Athlete, AthleteEmergencyContact, Game, TrainingAttendance } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, KpiCard } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, FullPageSpinner } from '@/components/ui/State';
import { formatDateTime } from '@/utils/format';

interface AttendanceWithTraining extends TrainingAttendance {
  training?: { id: string; date: string; location: string | null; sport_id: string } | null;
}

export function AthleteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const canSeeEmergency = profile && ['admin', 'sports', 'coach'].includes(profile.role);

  const athlete = useQuery<Athlete | null>(async () => {
    const { data, error } = await supabase
      .from('athletes')
      .select('*, sport:sports(id, name)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as Athlete | null;
  }, [id]);

  const attendance = useQuery<AttendanceWithTraining[]>(async () => {
    const { data } = await supabase
      .from('training_attendance')
      .select('*, training:trainings(id, date, location, sport_id)')
      .eq('athlete_id', id)
      .order('created_at', { ascending: false })
      .limit(30);
    return (data ?? []) as AttendanceWithTraining[];
  }, [id]);

  const games = useQuery<Game[]>(async () => {
    if (!athlete.data?.sport_id) return [];
    const { data } = await supabase
      .from('games')
      .select('*, sport:sports(id, name)')
      .eq('sport_id', athlete.data.sport_id)
      .order('date', { ascending: false })
      .limit(10);
    return (data ?? []) as Game[];
  }, [athlete.data?.sport_id]);

  const emergency = useQuery<AthleteEmergencyContact | null>(async () => {
    if (!canSeeEmergency) return null;
    const { data } = await supabase
      .from('athlete_emergency_contacts')
      .select('*')
      .eq('athlete_id', id)
      .maybeSingle();
    return data as AthleteEmergencyContact | null;
  }, [id, canSeeEmergency]);

  const stats = useMemo(() => {
    const list = attendance.data ?? [];
    const present = list.filter((a) => a.status === 'present').length;
    const absent = list.filter((a) => a.status === 'absent').length;
    const justified = list.filter((a) => a.status === 'justified').length;
    const rate = list.length > 0 ? Math.round((present / list.length) * 100) : null;
    return { present, absent, justified, rate, total: list.length };
  }, [attendance.data]);

  if (athlete.loading) return <FullPageSpinner />;
  if (athlete.error) return <ErrorState message={athlete.error} onRetry={() => void athlete.refetch()} />;
  if (!athlete.data) return <ErrorState message="Atleta não encontrado." onRetry={() => navigate('/esportes')} />;

  const a = athlete.data;

  return (
    <div>
      <PageHeader
        title={a.full_name}
        description={a.sport?.name ?? undefined}
        breadcrumbs={[
          { label: 'Início', to: '/' },
          { label: 'Esportes', to: '/esportes' },
          { label: a.full_name },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <Avatar name={a.full_name} src={a.photo_url} size="xl" />
            <div>
              <p className="text-lg font-semibold">{a.full_name}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {[a.sport?.name, a.position].filter(Boolean).join(' · ') || 'Atleta'}
              </p>
            </div>
            <Badge tone={a.status === 'active' ? 'success' : 'neutral'}>
              {a.status === 'active' ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          <dl className="mt-5 space-y-2.5 text-sm">
            {a.registration && (
              <div>
                <dt className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Matrícula</dt>
                <dd>{a.registration}</dd>
              </div>
            )}
            {a.course && (
              <div>
                <dt className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Curso</dt>
                <dd>
                  {a.course}
                  {a.semester ? ` · ${a.semester}º período` : ''}
                </dd>
              </div>
            )}
            {a.email && (
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-[var(--color-text-muted)]" aria-hidden />
                <span className="truncate">{a.email}</span>
              </div>
            )}
            {a.phone && (
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-[var(--color-text-muted)]" aria-hidden />
                <span>{a.phone}</span>
              </div>
            )}
          </dl>

          {canSeeEmergency && emergency.data && (
            <div className="mt-5 rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase">
                <ShieldAlert size={13} aria-hidden />
                Contato de emergência
              </p>
              <p className="text-sm">{emergency.data.contact_name}</p>
              <p className="text-sm">{emergency.data.contact_phone}</p>
              {emergency.data.relationship && (
                <p className="text-xs text-[var(--color-text-secondary)]">{emergency.data.relationship}</p>
              )}
            </div>
          )}
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard title="Frequência" value={stats.rate !== null ? `${stats.rate}%` : '—'} tone="info" />
            <KpiCard title="Presenças" value={stats.present} tone="success" />
            <KpiCard title="Faltas" value={stats.absent} tone={stats.absent > 0 ? 'danger' : 'default'} />
            <KpiCard title="Justificadas" value={stats.justified} tone="warning" />
          </div>

          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold">Histórico de presença</h3>
            {(attendance.data ?? []).length === 0 ? (
              <EmptyState title="Sem registros" description="A presença aparecerá aqui após as chamadas dos treinos." />
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {(attendance.data ?? []).map((row) => (
                  <li key={`${row.training_id}-${row.athlete_id}`} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-[var(--color-text-secondary)]">
                      {row.training ? formatDateTime(row.training.date) : '—'}
                      {row.training?.location ? ` · ${row.training.location}` : ''}
                    </span>
                    <Badge tone={row.status === 'present' ? 'success' : row.status === 'absent' ? 'danger' : 'warning'}>
                      {row.status === 'present' ? 'Presente' : row.status === 'absent' ? 'Ausente' : 'Justificado'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold">Jogos da modalidade</h3>
            {(games.data ?? []).length === 0 ? (
              <EmptyState title="Sem jogos" description="Os jogos da modalidade do atleta aparecerão aqui." />
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {(games.data ?? []).map((g) => (
                  <li key={g.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      × {g.opponent ?? 'Adversário'}
                      <span className="block text-xs text-[var(--color-text-muted)]">{formatDateTime(g.date)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {g.our_score !== null && g.opponent_score !== null && (
                        <span className="font-mono font-semibold">
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
            )}
          </Card>

          {a.notes && (
            <Card className="p-4">
              <h3 className="mb-1 text-sm font-semibold">Observações</h3>
              <p className="whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">{a.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
