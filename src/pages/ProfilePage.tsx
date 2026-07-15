import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Save, KeyRound, Camera } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { uploadFile, getFileUrl } from '@/services/storage';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Tabs } from '@/components/ui/Tabs';
import { roleLabels } from '@/utils/labels';

export function ProfilePage() {
  const { profile, refreshProfile, updatePassword } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState(searchParams.get('aba') === 'senha' ? 'password' : 'data');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form, setForm] = useState({ full_name: '', nickname: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({ password: '', confirm: '' });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name,
        nickname: profile.nickname ?? '',
        phone: profile.phone ?? '',
      });
    }
  }, [profile]);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || saving) return;
    if (form.full_name.trim().length < 3) {
      toast.error('Informe seu nome completo.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name.trim(),
        nickname: form.nickname.trim() || null,
        phone: form.phone.trim() || null,
      })
      .eq('id', profile.id);
    setSaving(false);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    toast.success('Perfil atualizado.');
    void refreshProfile();
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (passwordForm.password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (passwordForm.password !== passwordForm.confirm) {
      toast.error('As senhas não conferem.');
      return;
    }
    setSaving(true);
    const result = await updatePassword(passwordForm.password);
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Senha alterada com sucesso.');
    setPasswordForm({ password: '', confirm: '' });
  };

  const uploadAvatar = async (file: File) => {
    if (!profile || uploadingAvatar) return;
    setUploadingAvatar(true);
    const { path, error } = await uploadFile('avatars', profile.id, file);
    if (error || !path) {
      setUploadingAvatar(false);
      toast.error(error ?? 'Erro no upload.');
      return;
    }
    const url = await getFileUrl('avatars', path);
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id);
    setUploadingAvatar(false);
    toast.success('Foto atualizada.');
    void refreshProfile();
  };

  if (!profile) return null;

  return (
    <div>
      <PageHeader
        title="Meu perfil"
        breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Meu perfil' }]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="relative">
              <Avatar name={profile.full_name} src={profile.avatar_url} size="xl" />
              <label
                className="absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-[var(--color-primary)] p-1.5 text-white hover:bg-[var(--color-primary-hover)]"
                title="Alterar foto"
              >
                <Camera size={14} aria-hidden />
                <span className="sr-only">Alterar foto de perfil</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={uploadingAvatar}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadAvatar(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <div>
              <p className="text-lg font-semibold">{profile.full_name}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">{profile.email}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {roleLabels[profile.role]}
                {profile.department ? ` · ${profile.department.name}` : ''}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <Tabs
            tabs={[
              { id: 'data', label: 'Meus dados' },
              { id: 'password', label: 'Alterar senha' },
            ]}
            active={tab}
            onChange={setTab}
            className="mb-4"
          />

          {tab === 'data' ? (
            <form onSubmit={(e) => void saveProfile(e)} className="grid max-w-lg gap-4">
              <Input
                label="Nome completo"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
              <Input
                label="Apelido / nome social"
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              />
              <Input
                label="Telefone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <div>
                <Button type="submit" loading={saving} icon={<Save size={16} />}>
                  Salvar
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={(e) => void changePassword(e)} className="grid max-w-lg gap-4">
              <Input
                label="Nova senha"
                type="password"
                autoComplete="new-password"
                required
                value={passwordForm.password}
                onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                hint="Mínimo de 6 caracteres."
              />
              <Input
                label="Confirmar nova senha"
                type="password"
                autoComplete="new-password"
                required
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
              />
              <div>
                <Button type="submit" loading={saving} icon={<KeyRound size={16} />}>
                  Alterar senha
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
