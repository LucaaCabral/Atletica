import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    const result = await signIn(email.trim(), password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      navigate('/');
    }
  };

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
      <h2 className="text-lg font-semibold">Entrar</h2>

      {error && (
        <p role="alert" className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <Input
        label="E-mail"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="voce@exemplo.com"
      />
      <Input
        label="Senha"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
      />

      <Button type="submit" className="w-full" loading={loading} icon={<LogIn size={16} />}>
        Entrar
      </Button>

      <div className="flex flex-col gap-1 text-center text-sm">
        <Link to="/recuperar-senha" className="text-[var(--color-primary)] hover:underline">
          Esqueci minha senha
        </Link>
        <span className="text-[var(--color-text-secondary)]">
          Recebeu um convite?{' '}
          <Link to="/cadastro" className="text-[var(--color-primary)] hover:underline">
            Criar conta
          </Link>
        </span>
      </div>
    </form>
  );
}
