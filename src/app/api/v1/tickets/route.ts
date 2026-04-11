import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authenticateApiKey, requireScope, apiResponse, apiError } from '@/lib/api-keys'

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request)
  if (!auth.ok) return auth.response

  const scopeErr = requireScope(auth.context, 'tickets.read')
  if (scopeErr) return scopeErr

  const supabase = await createServiceClient()
  const { searchParams } = request.nextUrl

  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const orgId = searchParams.get('org_id')
  const search = searchParams.get('search')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') ?? '20', 10)))

  let query = supabase
    .from('tickets')
    .select(
      'id, ticket_number, org_id, title, status, priority, category, affected_service, assigned_to, created_by, created_at, updated_at',
      { count: 'exact' }
    )
    .is('deleted_at', null)

  // Scoped key: restrict to org
  if (auth.context.orgId) {
    query = query.eq('org_id', auth.context.orgId)
  } else if (orgId) {
    query = query.eq('org_id', orgId)
  }

  if (status) query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)
  if (search) query = query.or(`title.ilike.%${search}%,ticket_number.ilike.%${search}%`)

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1)

  if (error) return apiError('QUERY_ERROR', error.message, 500)

  return apiResponse({
    tickets: data ?? [],
    total: count ?? 0,
    page,
    per_page: perPage,
  })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request)
  if (!auth.ok) return auth.response

  const scopeErr = requireScope(auth.context, 'tickets.write')
  if (scopeErr) return scopeErr

  const body = await request.json()
  const {
    title,
    description,
    priority = 'medium',
    category,
    org_id,
    affected_service,
    environment,
    impact,
    steps_to_reproduce,
    expected_behavior,
    actual_behavior,
    tags,
    metadata,
  } = body

  if (!title || !description) {
    return apiError('VALIDATION_ERROR', 'Campos title e description obrigatorios', 400)
  }

  // Determine org_id: use from body, or fallback to key's org_id
  const resolvedOrgId = org_id || auth.context.orgId
  if (!resolvedOrgId) {
    return apiError('VALIDATION_ERROR', 'Campo org_id obrigatorio para keys globais', 400)
  }

  // Scoped key: verify org access
  if (auth.context.orgId && resolvedOrgId !== auth.context.orgId) {
    return apiError('FORBIDDEN', 'Key nao tem acesso a esta organizacao', 403)
  }

  const supabase = await createServiceClient()

  // Verify org exists
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', resolvedOrgId)
    .is('deleted_at', null)
    .single()

  if (!org) {
    return apiError('NOT_FOUND', 'Organizacao nao encontrada', 404)
  }

  // Use a system user ID for created_by (the key creator or first internal admin)
  let createdBy: string | null = null
  const { data: keyRecord } = await supabase
    .from('api_keys')
    .select('created_by')
    .eq('id', auth.context.keyId)
    .single()

  createdBy = keyRecord?.created_by ?? null

  if (!createdBy) {
    return apiError('SYSTEM_ERROR', 'Nao foi possivel determinar o usuario criador', 500)
  }

  const validStatuses = ['open', 'in_progress', 'waiting_client', 'waiting_internal', 'resolved', 'closed', 'cancelled']
  const validPriorities = ['critical', 'high', 'medium', 'low']

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      title,
      description,
      description_html: description,
      status: 'open',
      priority: validPriorities.includes(priority) ? priority : 'medium',
      category: category || null,
      org_id: resolvedOrgId,
      affected_service: affected_service || null,
      environment: environment || null,
      impact: impact || null,
      steps_to_reproduce: steps_to_reproduce || null,
      expected_behavior: expected_behavior || null,
      actual_behavior: actual_behavior || null,
      tags: tags || [],
      metadata: { ...metadata, source: 'api', api_key: auth.context.name },
      created_by: createdBy,
    })
    .select('id, ticket_number, org_id, title, status, priority, category, affected_service, created_at')
    .single()

  if (error) return apiError('CREATE_ERROR', error.message, 500)

  return apiResponse(ticket, 201)
}
