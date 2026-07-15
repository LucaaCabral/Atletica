import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 text-center">
      <span className="rounded-full bg-[var(--color-surface-secondary)] p-4 text-[var(--color-text-muted)]">
        <Compass size={32} aria-hidden />
      </span>
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">
        O endereço que você tentou acessar não existe ou foi movido.
      </p>
      <Link to="/">
        <Button className="mt-2">Voltar para o Dashboard</Button>
      </Link>
    </div>
  );
}
