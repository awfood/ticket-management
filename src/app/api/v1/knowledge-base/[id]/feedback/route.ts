import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authenticateApiKey, requireScope, apiResponse, apiError } from '@/lib/api-keys'

/**
 * GET /api/v1/knowledge-base/:id/feedback
 * Get feedback summary for an article (requires kb.read)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request)
  if (!auth.ok) return auth.response

  const scopeErr = requireScope(auth.context, 'kb.read')
  if (scopeErr) return scopeErr

  const { id } = await params
  const supabase = await createServiceClient()

  const { data: feedback, error } = await supabase
    .from('knowledge_base_feedback')
    .select('id, is_helpful, comment, created_at')
    .eq('article_id', id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return apiError('QUERY_ERROR', error.message, 500)

  const helpful = feedback?.filter(f => f.is_helpful).length ?? 0
  const notHelpful = feedback?.filter(f => !f.is_helpful).length ?? 0

  return apiResponse({
    article_id: id,
    helpful,
    not_helpful: notHelpful,
    total: feedback?.length ?? 0,
    recent_feedback: feedback ?? [],
  })
}

/**
 * POST /api/v1/knowledge-base/:id/feedback
 * Submit feedback for an article (requires kb.write)
 *
 * Body: { is_helpful: boolean, comment?: string }
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
  const { is_helpful, comment } = body

  if (typeof is_helpful !== 'boolean') {
    return apiError('VALIDATION_ERROR', 'Campo is_helpful (boolean) obrigatorio', 400)
  }

  const supabase = await createServiceClient()

  // Verify article exists
  const { data: article } = await supabase
    .from('knowledge_base_articles')
    .select('id')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!article) {
    return apiError('NOT_FOUND', 'Artigo nao encontrado', 404)
  }

  // Insert feedback
  const { error: feedbackError } = await supabase
    .from('knowledge_base_feedback')
    .insert({
      article_id: id,
      is_helpful,
      comment: comment ?? null,
      user_identifier: auth.context.name,
    })

  if (feedbackError) {
    return apiError('CREATE_ERROR', feedbackError.message, 500)
  }

  // Update counters on the article
  const counterField = is_helpful ? 'helpful_count' : 'not_helpful_count'
  const { data: current } = await supabase
    .from('knowledge_base_articles')
    .select(counterField)
    .eq('id', id)
    .single()

  if (current) {
    await supabase
      .from('knowledge_base_articles')
      .update({ [counterField]: (current[counterField] as number ?? 0) + 1 })
      .eq('id', id)
  }

  return apiResponse({ success: true }, 201)
}
