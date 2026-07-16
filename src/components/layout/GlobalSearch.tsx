import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare,
  PartyPopper,
  Users,
  Trophy,
  Handshake,
  FolderOpen,
  Search,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useDebounce } from '@/hooks/useDebounce';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/State';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  kind: 'task' | 'event' | 'member' | 'athlete' | 'sponsor' | 'document';
  to: string;
}

const kindIcons = {
  task: CheckSquare,
  event: PartyPopper,
  member: Users,
  athlete: Trophy,
  sponsor: Handshake,
  document: FolderOpen,
};

const kindLabels = {
  task: 'Tarefa',
  event: 'Evento',
  member: 'Membro',
  athlete: 'Atleta',
  sponsor: 'Patrocinador',
  document: 'Documento',
};

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounce(term, 300);

  useEffect(() => {
    if (!open) {
      setTerm('');
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!debounced || debounced.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const like = `%${debounced}%`;

    void Promise.all([
      supabase.from('tasks').select('id, title, status').ilike('title', like).limit(5),
      supabase.from('events').select('id, name, category').ilike('name', like).limit(5),
      supabase.from('members').select('id, full_name, email').ilike('full_name', like).limit(5),
      supabase.from('athletes').select('id, full_name, course').ilike('full_name', like).limit(5),
      supabase.from('sponsors').select('id, company_name, segment').ilike('company_name', like).limit(5),
      supabase.from('documents').select('id, name, category').ilike('name', like).limit(5),
    ]).then(([tasks, events, members, athletes, sponsors, documents]) => {
      if (cancelled) return;
      const items: SearchResult[] = [
        ...(tasks.data ?? []).map((t) => ({
          id: t.id as string,
          title: t.title as string,
          subtitle: 'Tarefa',
          kind: 'task' as const,
          to: `/tarefas?task=${t.id}`,
        })),
        ...(events.data ?? []).map((e) => ({
          id: e.id as string,
          title: e.name as string,
          subtitle: (e.category as string) ?? 'Evento',
          kind: 'event' as const,
          to: `/eventos/${e.id}`,
        })),
        ...(members.data ?? []).map((m) => ({
          id: m.id as string,
          title: m.full_name as string,
          subtitle: (m.email as string) ?? 'Membro',
          kind: 'member' as const,
          to: `/membros/${m.id}`,
        })),
        ...(athletes.data ?? []).map((a) => ({
          id: a.id as string,
          title: a.full_name as string,
          subtitle: (a.course as string) ?? 'Atleta',
          kind: 'athlete' as const,
          to: `/esportes/atletas/${a.id}`,
        })),
        ...(sponsors.data ?? []).map((s) => ({
          id: s.id as string,
          title: s.company_name as string,
          subtitle: (s.segment as string) ?? 'Patrocinador',
          kind: 'sponsor' as const,
          to: '/patrocinadores',
        })),
        ...(documents.data ?? []).map((d) => ({
          id: d.id as string,
          title: d.name as string,
          subtitle: (d.category as string) ?? 'Documento',
          kind: 'document' as const,
          to: '/documentos',
        })),
      ];
      setResults(items);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const grouped = useMemo(() => results, [results]);

  return (
    <Modal open={open} onClose={onClose} title="Busca global" size="lg">
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden />
        <input
          autoFocus
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar tarefas, eventos, membros, atletas, patrocinadores, documentos…"
          aria-label="Buscar no sistema"
          className="h-11 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] pl-9 pr-3 text-sm focus:border-[var(--color-primary)]"
        />
      </div>

      {loading && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}

      {!loading && debounced.length >= 2 && grouped.length === 0 && (
        <p className="py-6 text-center text-sm text-[var(--color-text-secondary)]">
          Nenhum resultado para “{debounced}”.
        </p>
      )}

      {!loading && grouped.length > 0 && (
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {grouped.map((r) => {
            const Icon = kindIcons[r.kind];
            return (
              <li key={`${r.kind}-${r.id}`}>
                <button
                  onClick={() => {
                    onClose();
                    navigate(r.to);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-[var(--color-surface-hover)]"
                >
                  <span className="rounded-lg bg-[var(--color-surface-secondary)] p-2 text-[var(--color-text-secondary)]">
                    <Icon size={16} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.title}</span>
                    <span className="block truncate text-xs text-[var(--color-text-muted)]">{r.subtitle}</span>
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)]">{kindLabels[r.kind]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {debounced.length < 2 && !loading && (
        <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">
          Digite pelo menos 2 caracteres para buscar.
        </p>
      )}
    </Modal>
  );
}
