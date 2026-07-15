import { supabase } from '@/lib/supabase';

export async function logActivity(params: {
  action: 'create' | 'update' | 'delete' | 'status_change' | 'upload' | 'permission_change';
  module: string;
  entityType?: string;
  entityId?: string;
  summary?: string;
}): Promise<void> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from('activity_logs').insert({
    user_id: data.user.id,
    action: params.action,
    module: params.module,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    summary: params.summary ?? null,
  });
}
