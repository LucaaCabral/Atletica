import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function RegisterPage() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (fullName.trim().length < 3) {
      setError('Informe seu nome completo.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não conferem.');
      return;
    }

    setLoading(true);
    const result = await signUp(email.trim(), password, fullName.trim());
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-lg font-semibold">Conta criada!</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Se a confirmação de e-mail estiver ativa no projeto, verifique sua caixa de entrada antes de entrar.
        </p>
        <Link to="/login">
          <Button className="w-full">Ir para o login</Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
      <div>
        <h2 className="text-lg font-semibold">Criar conta</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          O cadastro é restrito a e-mails convidados por um administrador.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <Input label="Nome completo" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <Input
        label="E-mail convidado"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label="Senha"
        type="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint="Mínimo de 6 caracteres."
      />
      <Input
        label="Confirmar senha"
        type="password"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />

      <Button type="submit" className="w-full" loading={loading} icon={<UserPlus size={16} />}>
        Criar conta
      </Button>

      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        Já possui conta?{' '}
        <Link to="/login" className="text-[var(--color-primary)] hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
