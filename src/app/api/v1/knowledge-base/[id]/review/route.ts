import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authenticateApiKey, requireScope, apiResponse, apiError } from '@/lib/api-keys'

/**
 * POST /api/v1/knowledge-base/:id/review
 * Review an article: approve, reject, or mark as needs_edit
 *
 * Body: { status: 'approved' | 'rejected' | 'needs_edit', notes?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request)
  if (!auth.ok) return auth.response

  const scopeErr = requireScope(auth.context, 'kb.write')
  if (scopeErr) return scopeErr

  const { id } = await params
  const body = await request.json()
  const { status, notes } = body

  const validStatuses = ['approved', 'rejected', 'needs_edit', 'pending_review']
  if (!status || !validStatuses.includes(status)) {
    return apiError(
      'VALIDATION_ERROR',
      `Campo status obrigatorio. Valores validos: ${validStatuses.join(', ')}`,
      400
    )
  }

  const supabase = await createServiceClient()

  // Get reviewer identity from API key
  const { data: keyRecord } = await supabase
    .from('api_keys')
    .select('created_by')
    .eq('id', auth.context.keyId)
    .single()

  const updates: Record<string, unknown> = {
    review_status: status,
    reviewed_at: new Date().toISOString(),
    reviewed_by: keyRecord?.created_by ?? null,
  }

  if (notes !== undefined) {
    updates.review_notes = notes
  }

  // If approved, auto-publish
  if (status === 'approved') {
    updates.is_published = true
  }

  // If rejected, auto-unpublish
  if (status === 'rejected') {
    updates.is_published = false
  }

  const { data: article, error } = await supabase
    .from('knowledge_base_articles')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, title, review_status, review_notes, reviewed_at, is_published')
    .single()

  if (error || !article) {
    return apiError('UPDATE_ERROR', error?.message ?? 'Artigo nao encontrado', error ? 500 : 404)
  }

  return apiResponse(article)
}
