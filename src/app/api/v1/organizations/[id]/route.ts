import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authenticateApiKey, requireScope, apiResponse, apiError } from '@/lib/api-keys'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await authenticateApiKey(request)
  if (!auth.ok) return auth.response

  const scopeErr = requireScope(auth.context, 'orgs.read')
  if (scopeErr) return scopeErr

  const supabase = await createServiceClient()

  const { data: org, error } = await supabase
    .from('organizations')
    .select('id, name, slug, type, parent_org_id, settings, created_at, updated_at')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !org) {
    return apiError('NOT_FOUND', 'Organizacao nao encontrada', 404)
  }

  // Scoped key: verify access
  if (auth.context.orgId && org.id !== auth.context.orgId && org.parent_org_id !== auth.context.orgId) {
    return apiError('FORBIDDEN', 'Sem acesso a esta organizacao', 403)
  }

  // Fetch children count
  const { count: childrenCount } = await supabase
    .from('organizations')
    .select('id', { count: 'exact', head: true })
    .eq('parent_org_id', id)
    .is('deleted_at', null)

  return apiResponse({
    ...org,
    children_count: childrenCount ?? 0,
  })
}
