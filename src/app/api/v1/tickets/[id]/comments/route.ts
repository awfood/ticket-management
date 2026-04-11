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

  // Verify ticket access
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, org_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!ticket) {
    return apiError('NOT_FOUND', 'Ticket nao encontrado', 404)
  }

  if (auth.context.orgId && ticket.org_id !== auth.context.orgId) {
    return apiError('FORBIDDEN', 'Sem acesso a este ticket', 403)
  }

  let query = supabase
    .from('ticket_comments')
    .select('id, ticket_id, author_id, body, is_internal, comment_type, created_at, author:profiles!ticket_comments_author_id_fkey(id, full_name)')
    .eq('ticket_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  // Scoped (non-global) keys: hide internal notes
  if (auth.context.orgId) {
    query = query.eq('is_internal', false)
  }

  const { data: comments, error } = await query

  if (error) return apiError('QUERY_ERROR', error.message, 500)

  return apiResponse({ comments: comments ?? [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await authenticateApiKey(request)
  if (!auth.ok) return auth.response

  const scopeErr = requireScope(auth.context, 'comments.write')
  if (scopeErr) return scopeErr

  const body = await request.json()
  const { body: commentBody, is_internal = false, comment_type = 'reply' } = body

  if (!commentBody) {
    return apiError('VALIDATION_ERROR', 'Campo body obrigatorio', 400)
  }

  const supabase = await createServiceClient()

  // Verify ticket access
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, org_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!ticket) {
    return apiError('NOT_FOUND', 'Ticket nao encontrado', 404)
  }

  if (auth.context.orgId && ticket.org_id !== auth.context.orgId) {
    return apiError('FORBIDDEN', 'Sem acesso a este ticket', 403)
  }

  // Only global keys can create internal notes
  if (is_internal && auth.context.orgId) {
    return apiError('FORBIDDEN', 'Apenas keys globais podem criar notas internas', 403)
  }

  // Get author from key creator
  const { data: keyRecord } = await supabase
    .from('api_keys')
    .select('created_by')
    .eq('id', auth.context.keyId)
    .single()

  const authorId = keyRecord?.created_by
  if (!authorId) {
    return apiError('SYSTEM_ERROR', 'Nao foi possivel determinar o autor', 500)
  }

  const validTypes = ['reply', 'internal_note', 'system']
  const { data: comment, error } = await supabase
    .from('ticket_comments')
    .insert({
      ticket_id: id,
      author_id: authorId,
      body: commentBody,
      body_html: commentBody,
      is_internal: is_internal || false,
      comment_type: validTypes.includes(comment_type) ? comment_type : 'reply',
      metadata: { source: 'api', api_key: auth.context.name },
    })
    .select('id, ticket_id, body, is_internal, comment_type, created_at')
    .single()

  if (error) return apiError('CREATE_ERROR', error.message, 500)

  return apiResponse(comment, 201)
}
