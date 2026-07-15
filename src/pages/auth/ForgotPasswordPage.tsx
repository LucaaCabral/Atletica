import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    const result = await requestPasswordReset(email.trim());
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-lg font-semibold">Verifique seu e-mail</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Se existir uma conta para <strong>{email}</strong>, enviamos um link para redefinir a senha.
        </p>
        <Link to="/login" className="text-sm text-[var(--color-primary)] hover:underline">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
      <div>
        <h2 className="text-lg font-semibold">Recuperar senha</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Informe seu e-mail e enviaremos um link de redefinição.
        </p>
      </div>

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
      />

      <Button type="submit" className="w-full" loading={loading} icon={<Mail size={16} />}>
        Enviar link
      </Button>

      <p className="text-center text-sm">
        <Link to="/login" className="text-[var(--color-primary)] hover:underline">
          Voltar para o login
        </Link>
      </p>
    </form>
  );
}
