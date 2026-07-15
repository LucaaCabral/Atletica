import { supabase } from '@/lib/supabase';

export const MAX_FILE_SIZE = 20 * 1024 * 1024;

const BLOCKED_EXTENSIONS = ['exe', 'bat', 'cmd', 'sh', 'msi', 'com', 'scr'];

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return 'O arquivo excede o tamanho máximo de 20 MB.';
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return 'Este tipo de arquivo não é permitido.';
  }
  return null;
}

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-80);
}

export async function uploadFile(
  bucket: string,
  folder: string,
  file: File,
): Promise<{ path: string | null; error: string | null }> {
  const validation = validateFile(file);
  if (validation) return { path: null, error: validation };

  const path = `${folder}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  return { path: error ? null : path, error: error ? error.message : null };
}

export async function getFileUrl(bucket: string, path: string): Promise<string | null> {
  const publicBuckets = ['avatars', 'branding'];
  if (publicBuckets.includes(bucket)) {
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function deleteFile(bucket: string, path: string): Promise<{ error: string | null }> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  return { error: error ? error.message : null };
}

export async function downloadFile(bucket: string, path: string, fileName: string): Promise<void> {
  const url = await getFileUrl(bucket, path);
  if (!url) return;
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
