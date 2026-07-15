import { useState } from 'react';
import type { FormEvent } from 'react';
import { FolderOpen, Upload, Download, Trash2, Pencil, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useQuery } from '@/hooks/useQuery';
import { useDebounce } from '@/hooks/useDebounce';
import { logActivity } from '@/services/activityLog';
import { uploadFile, deleteFile, downloadFile } from '@/services/storage';
import type { DocumentItem, Event, Sponsor } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Input, Select, SearchInput, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState, ErrorState } from '@/components/ui/State';
import { formatDate, formatFileSize } from '@/utils/format';

function splitPath(filePath: string): { bucket: string; path: string } {
  const idx = filePath.indexOf(':');
  if (idx === -1) return { bucket: 'documents', path: filePath };
  return { bucket: filePath.slice(0, idx), path: filePath.slice(idx + 1) };
}

export function DocumentsPage() {
  const { profile, can } = useAuth();
  const { docCategories } = useSettings();
  const toast = useToast();
  const canManage = can('documents.manage');

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [renaming, setRenaming] = useState<DocumentItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleting, setDeleting] = useState<DocumentItem | null>(null);
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    name: '',
    description: '',
    category: 'Outros',
    folder: '',
    access_level: 'all' as 'all' | 'directors' | 'admin',
    related_type: '',
    related_id: '',
  });
  const debouncedSearch = useDebounce(search);

  const documents = useQuery<DocumentItem[]>(async () => {
    let query = supabase
      .from('documents')
      .select('*, uploader:profiles(id, full_name)')
      .order('created_at', { ascending: false });
    if (debouncedSearch) query = query.ilike('name', `%${debouncedSearch}%`);
    if (categoryFilter) query = query.eq('category', categoryFilter);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const list = (data ?? []) as DocumentItem[];
    return list.filter((d) => {
      if (d.access_level === 'admin') return profile?.role === 'admin';
      if (d.access_level === 'directors') return profile ? ['admin', 'director'].includes(profile.role) : false;
      return true;
    });
  }, [debouncedSearch, categoryFilter, profile?.role]);

  const events = useQuery<Pick<Event, 'id' | 'name'>[]>(async () => {
    const { data } = await supabase.from('events').select('id, name').order('start_date', { ascending: false });
    return (data ?? []) as Pick<Event, 'id' | 'name'>[];
  });

  const sponsors = useQuery<Pick<Sponsor, 'id' | 'company_name'>[]>(async () => {
    const { data } = await supabase.from('sponsors').select('id, company_name').order('company_name');
    return (data ?? []) as Pick<Sponsor, 'id' | 'company_name'>[];
  });

  const doUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (uploading) return;
    if (!uploadForm.file) {
      toast.error('Selecione um arquivo.');
      return;
    }
    setUploading(true);
    const { path, error } = await uploadFile('documents', uploadForm.category.toLowerCase(), uploadForm.file);
    if (error || !path) {
      setUploading(false);
      toast.error(error ?? 'Erro no upload.');
      return;
    }
    const { error: dbError } = await supabase.from('documents').insert({
      name: uploadForm.name.trim() || uploadForm.file.name,
      description: uploadForm.description.trim() || null,
      category: uploadForm.category,
      folder: uploadForm.folder.trim() || null,
      file_path: `documents:${path}`,
      file_size: uploadForm.file.size,
      mime_type: uploadForm.file.type,
      uploaded_by: profile?.id ?? null,
      related_type: uploadForm.related_type || null,
      related_id: uploadForm.related_id || null,
      access_level: uploadForm.access_level,
    });
    setUploading(false);
    if (dbError) {
      toast.error(`Erro ao registrar documento: ${dbError.message}`);
      return;
    }
    toast.success('Documento enviado.');
    void logActivity({
      action: 'upload',
      module: 'documentos',
      entityType: 'document',
      summary: `Enviou o documento "${uploadForm.name.trim() || uploadForm.file.name}"`,
    });
    setUploadOpen(false);
    setUploadForm({ file: null, name: '', description: '', category: 'Outros', folder: '', access_level: 'all', related_type: '', related_id: '' });
    void documents.refetch();
  };

  const doRename = async () => {
    if (!renaming || !renameValue.trim()) return;
    const { error } = await supabase.from('documents').update({ name: renameValue.trim() }).eq('id', renaming.id);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    toast.success('Documento renomeado.');
    setRenaming(null);
    void documents.refetch();
  };

  const doDelete = async () => {
    if (!deleting) return;
    const { bucket, path } = splitPath(deleting.file_path);
    await deleteFile(bucket, path);
    const { error } = await supabase.from('documents').delete().eq('id', deleting.id);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    toast.success('Documento excluído.');
    void logActivity({
      action: 'delete',
      module: 'documentos',
      entityType: 'document',
      entityId: deleting.id,
      summary: `Excluiu o documento "${deleting.name}"`,
    });
    setDeleting(null);
    void documents.refetch();
  };

  const doDownload = (doc: DocumentItem) => {
    const { bucket, path } = splitPath(doc.file_path);
    void downloadFile(bucket, path, doc.name);
  };

  const columns: Column<DocumentItem>[] = [
    {
      key: 'name',
      header: 'Documento',
      render: (d) => (
        <span className="flex items-center gap-2">
          <span className="rounded-lg bg-[var(--color-surface-secondary)] p-2 text-[var(--color-text-secondary)]">
            <FileText size={15} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{d.name}</span>
            {d.description && (
              <span className="block truncate text-xs text-[var(--color-text-muted)]">{d.description}</span>
            )}
          </span>
        </span>
      ),
    },
    { key: 'category', header: 'Categoria', render: (d) => <Badge>{d.category}</Badge> },
    { key: 'folder', header: 'Pasta', render: (d) => d.folder ?? '—', hideOnMobile: true },
    { key: 'size', header: 'Tamanho', render: (d) => formatFileSize(d.file_size), hideOnMobile: true },
    { key: 'uploader', header: 'Enviado por', render: (d) => d.uploader?.full_name ?? '—', hideOnMobile: true },
    { key: 'date', header: 'Data', render: (d) => formatDate(d.created_at), hideOnMobile: true },
    {
      key: 'access',
      header: 'Acesso',
      hideOnMobile: true,
      render: (d) => (
        <Badge tone={d.access_level === 'admin' ? 'danger' : d.access_level === 'directors' ? 'warning' : 'success'}>
          {d.access_level === 'admin' ? 'Admins' : d.access_level === 'directors' ? 'Diretores' : 'Todos'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (d) => (
        <span className="flex justify-end gap-1">
          <IconButton label={`Baixar ${d.name}`} size="sm" onClick={() => doDownload(d)}>
            <Download size={15} />
          </IconButton>
          {canManage && (
            <>
              <IconButton
                label={`Renomear ${d.name}`}
                size="sm"
                onClick={() => {
                  setRenaming(d);
                  setRenameValue(d.name);
                }}
              >
                <Pencil size={15} />
              </IconButton>
              <IconButton label={`Excluir ${d.name}`} size="sm" onClick={() => setDeleting(d)}>
                <Trash2 size={15} className="text-[var(--color-danger)]" />
              </IconButton>
            </>
          )}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Documentos"
        description="Biblioteca central de contratos, atas, comprovantes e artes."
        breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Documentos' }]}
        actions={
          canManage && (
            <Button icon={<Upload size={16} />} onClick={() => setUploadOpen(true)}>
              Enviar documento
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput
          placeholder="Buscar documento…"
          aria-label="Buscar documento"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          containerClassName="flex-1"
        />
        <Select
          aria-label="Filtrar por categoria"
          options={docCategories.map((c) => ({ value: c, label: c }))}
          placeholder="Todas as categorias"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="sm:w-52"
        />
      </div>

      {documents.error ? (
        <ErrorState message={documents.error} onRetry={() => void documents.refetch()} />
      ) : (
        <Card>
          <DataTable
            columns={columns}
            rows={documents.data ?? []}
            rowKey={(d) => d.id}
            loading={documents.loading}
            emptyState={
              <EmptyState
                icon={<FolderOpen size={24} />}
                title="Nenhum documento na biblioteca"
                description="Envie o primeiro documento para centralizar os arquivos da Atlética."
                actionLabel={canManage ? 'Enviar documento' : undefined}
                onAction={canManage ? () => setUploadOpen(true) : undefined}
              />
            }
          />
        </Card>
      )}

      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Enviar documento"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
              Cancelar
            </Button>
            <Button loading={uploading} onClick={(e) => void doUpload(e as unknown as FormEvent)}>
              Enviar
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => void doUpload(e)} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-sm font-medium">
              Arquivo <span className="text-[var(--color-danger)]">*</span>
            </p>
            <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-[var(--color-border-strong)] px-4 py-6 text-center hover:border-[var(--color-primary)]">
              <Upload size={20} className="text-[var(--color-text-muted)]" aria-hidden />
              <span className="text-sm font-medium">
                {uploadForm.file ? uploadForm.file.name : 'Clique para selecionar o arquivo'}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">Máximo de 20 MB</span>
              <input
                type="file"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setUploadForm((f) => ({ ...f, file, name: f.name || file?.name || '' }));
                }}
              />
            </label>
          </div>
          <Input
            label="Nome"
            value={uploadForm.name}
            onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
            hint="Se vazio, usa o nome do arquivo."
          />
          <Select
            label="Categoria"
            options={docCategories.map((c) => ({ value: c, label: c }))}
            value={uploadForm.category}
            onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
          />
          <Input
            label="Pasta"
            placeholder="Ex.: JUTEL 2026"
            value={uploadForm.folder}
            onChange={(e) => setUploadForm({ ...uploadForm, folder: e.target.value })}
          />
          <Select
            label="Nível de acesso"
            options={[
              { value: 'all', label: 'Todos os usuários' },
              { value: 'directors', label: 'Diretores e admins' },
              { value: 'admin', label: 'Somente admins' },
            ]}
            value={uploadForm.access_level}
            onChange={(e) => setUploadForm({ ...uploadForm, access_level: e.target.value as 'all' | 'directors' | 'admin' })}
          />
          <Select
            label="Vincular a"
            options={[
              { value: 'event', label: 'Evento' },
              { value: 'sponsor', label: 'Patrocinador' },
            ]}
            placeholder="Nada"
            value={uploadForm.related_type}
            onChange={(e) => setUploadForm({ ...uploadForm, related_type: e.target.value, related_id: '' })}
          />
          {uploadForm.related_type === 'event' && (
            <Select
              label="Evento"
              options={(events.data ?? []).map((ev) => ({ value: ev.id, label: ev.name }))}
              placeholder="Selecione…"
              value={uploadForm.related_id}
              onChange={(e) => setUploadForm({ ...uploadForm, related_id: e.target.value })}
            />
          )}
          {uploadForm.related_type === 'sponsor' && (
            <Select
              label="Patrocinador"
              options={(sponsors.data ?? []).map((s) => ({ value: s.id, label: s.company_name }))}
              placeholder="Selecione…"
              value={uploadForm.related_id}
              onChange={(e) => setUploadForm({ ...uploadForm, related_id: e.target.value })}
            />
          )}
          <div className="sm:col-span-2">
            <Textarea
              label="Descrição"
              value={uploadForm.description}
              onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title="Renomear documento"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void doRename()}>Salvar</Button>
          </>
        }
      >
        <Input label="Novo nome" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
      </Modal>

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        title="Excluir documento"
        message={`Tem certeza que deseja excluir "${deleting?.name ?? ''}"? O arquivo será removido do Storage.`}
        confirmLabel="Excluir"
      />
    </div>
  );
}
