import { Link } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function AccessDeniedPage() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 text-center">
      <span className="rounded-full bg-[var(--color-danger-soft)] p-4 text-[var(--color-danger)]">
        <ShieldX size={32} aria-hidden />
      </span>
      <h1 className="text-2xl font-bold">Acesso negado</h1>
      <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">
        Você não tem permissão para acessar esta área. Fale com um administrador se acredita que isso é um engano.
      </p>
      <Link to="/">
        <Button className="mt-2" variant="outline">
          Voltar para o Dashboard
        </Button>
      </Link>
    </div>
  );
}
