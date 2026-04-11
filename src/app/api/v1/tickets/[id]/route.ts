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

  const scopeErr = requireScope(auth.context, 'tickets.read')
  if (scopeErr) return scopeErr

  const supabase = await createServiceClient()

  const { data: ticket, error } = await supabase
    .from('tickets')
    .select(`
      *,
      organization:organizations(id, name, slug),
      creator:profiles!tickets_created_by_fkey(id, full_name),
      assignee:profiles!tickets_assigned_to_fkey(id, full_name)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !ticket) {
    return apiError('NOT_FOUND', 'Ticket nao encontrado', 404)
  }

  // Scoped key: verify org access
  if (auth.context.orgId && ticket.org_id !== auth.context.orgId) {
    return apiError('FORBIDDEN', 'Sem acesso a este ticket', 403)
  }

  // Fetch comments count and attachments count
  const [commentsResult, attachmentsResult] = await Promise.all([
    supabase
      .from('ticket_comments')
      .select('id', { count: 'exact', head: true })
      .eq('ticket_id', id)
      .is('deleted_at', null),
    supabase
      .from('ticket_attachments')
      .select('id', { count: 'exact', head: true })
      .eq('ticket_id', id),
  ])

  return apiResponse({
    ...ticket,
    comments_count: commentsResult.count ?? 0,
    attachments_count: attachmentsResult.count ?? 0,
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await authenticateApiKey(request)
  if (!auth.ok) return auth.response

  const scopeErr = requireScope(auth.context, 'tickets.write')
  if (scopeErr) return scopeErr

  const supabase = await createServiceClient()

  // Verify ticket exists and access
  const { data: existing } = await supabase
    .from('tickets')
    .select('id, org_id, status')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!existing) {
    return apiError('NOT_FOUND', 'Ticket nao encontrado', 404)
  }

  if (auth.context.orgId && existing.org_id !== auth.context.orgId) {
    return apiError('FORBIDDEN', 'Sem acesso a este ticket', 403)
  }

  const body = await request.json()
  const allowedFields = [
    'title', 'description', 'status', 'priority', 'category',
    'affected_service', 'environment', 'impact', 'assigned_to',
    'steps_to_reproduce', 'expected_behavior', 'actual_behavior',
    'tags', 'metadata',
  ]

  const updates: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return apiError('VALIDATION_ERROR', 'Nenhum campo para atualizar', 400)
  }

  // Handle status transition timestamps
  if (updates.status === 'resolved' && existing.status !== 'resolved') {
    updates.resolved_at = new Date().toISOString()
  }
  if (updates.status === 'closed' && existing.status !== 'closed') {
    updates.closed_at = new Date().toISOString()
  }

  updates.updated_at = new Date().toISOString()

  const { data: ticket, error } = await supabase
    .from('tickets')
    .update(updates)
    .eq('id', id)
    .select('id, ticket_number, title, status, priority, category, updated_at')
    .single()

  if (error) return apiError('UPDATE_ERROR', error.message, 500)

  return apiResponse(ticket)
}
