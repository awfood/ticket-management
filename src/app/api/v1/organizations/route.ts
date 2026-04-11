import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authenticateApiKey, requireScope, apiResponse, apiError } from '@/lib/api-keys'

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request)
  if (!auth.ok) return auth.response

  const scopeErr = requireScope(auth.context, 'orgs.read')
  if (scopeErr) return scopeErr

  const supabase = await createServiceClient()
  const { searchParams } = request.nextUrl
  const search = searchParams.get('search')
  const type = searchParams.get('type')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') ?? '20', 10)))

  let query = supabase
    .from('organizations')
    .select('id, name, slug, type, parent_org_id, created_at, updated_at', { count: 'exact' })
    .is('deleted_at', null)
    .neq('type', 'internal')

  // Scoped key: only return the linked org and its children
  if (auth.context.orgId) {
    query = query.or(`id.eq.${auth.context.orgId},parent_org_id.eq.${auth.context.orgId}`)
  }

  if (type) query = query.eq('type', type)
  if (search) query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`)

  const { data, error, count } = await query
    .order('name')
    .range((page - 1) * perPage, page * perPage - 1)

  if (error) return apiError('QUERY_ERROR', error.message, 500)

  return apiResponse({
    organizations: data ?? [],
    total: count ?? 0,
    page,
    per_page: perPage,
  })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request)
  if (!auth.ok) return auth.response

  const scopeErr = requireScope(auth.context, 'orgs.write')
  if (scopeErr) return scopeErr

  const body = await request.json()
  const { name, slug, type, parent_org_id } = body

  if (!name || !slug) {
    return apiError('VALIDATION_ERROR', 'Campos name e slug obrigatorios', 400)
  }

  if (type && !['client', 'whitelabel'].includes(type)) {
    return apiError('VALIDATION_ERROR', 'Tipo deve ser client ou whitelabel', 400)
  }

  const supabase = await createServiceClient()

  // Check slug uniqueness
  const { data: existing } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single()

  if (existing) {
    return apiError('SLUG_EXISTS', 'Slug ja esta em uso', 409)
  }

  const { data: org, error } = await supabase
    .from('organizations')
    .insert({
      name,
      slug,
      type: type || 'client',
      parent_org_id: parent_org_id || null,
      settings: {},
    })
    .select('id, name, slug, type, parent_org_id, created_at')
    .single()

  if (error) return apiError('CREATE_ERROR', error.message, 500)

  return apiResponse(org, 201)
}
