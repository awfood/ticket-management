import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authenticateApiKey, requireScope, apiResponse, apiError } from '@/lib/api-keys'

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

  // Suporta busca por UUID (id) ou por slug
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

  let query = supabase
    .from('knowledge_base_articles')
    .select('*')
    .is('deleted_at', null)

  if (isUuid) {
    query = query.eq('id', id)
  } else {
    query = query.eq('slug', id)
  }

  const { data: article, error } = await query.single()

  if (error || !article) {
    return apiError('NOT_FOUND', 'Artigo nao encontrado', 404)
  }

  return apiResponse(article)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request)
  if (!auth.ok) return auth.response

  const scopeErr = requireScope(auth.context, 'kb.write')
  if (scopeErr) return scopeErr

  const { id } = await params
  const body = await request.json()
  const {
    title,
    content,
    content_html,
    category,
    tags,
    slug,
    sort_order,
    is_published,
    review_status,
    review_notes,
    source,
    confidence_score,
    confidence_notes,
  } = body

  const updates: Record<string, unknown> = {}
  if (title !== undefined) updates.title = title
  if (content !== undefined) updates.content = content
  if (content_html !== undefined) updates.content_html = content_html
  if (category !== undefined) updates.category = category
  if (tags !== undefined) updates.tags = tags
  if (slug !== undefined) updates.slug = slug
  if (sort_order !== undefined) updates.sort_order = sort_order
  if (confidence_score !== undefined) updates.confidence_score = confidence_score === null ? null : Math.max(0, Math.min(100, parseInt(confidence_score, 10)))
  if (confidence_notes !== undefined) updates.confidence_notes = confidence_notes
  if (is_published !== undefined) updates.is_published = is_published
  if (review_status !== undefined) updates.review_status = review_status
  if (review_notes !== undefined) updates.review_notes = review_notes
  if (source !== undefined) updates.source = source

  if (Object.keys(updates).length === 0) {
    return apiError('VALIDATION_ERROR', 'Nenhum campo para atualizar', 400)
  }

  const supabase = await createServiceClient()

  const { data: article, error } = await supabase
    .from('knowledge_base_articles')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, title, slug, category, is_published, review_status, review_notes, source, updated_at')
    .single()

  if (error || !article) {
    return apiError('UPDATE_ERROR', error?.message ?? 'Artigo nao encontrado', error ? 500 : 404)
  }

  return apiResponse(article)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request)
  if (!auth.ok) return auth.response

  const scopeErr = requireScope(auth.context, 'kb.write')
  if (scopeErr) return scopeErr

  const { id } = await params
  const supabase = await createServiceClient()

  const { error } = await supabase
    .from('knowledge_base_articles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)

  if (error) {
    return apiError('DELETE_ERROR', error.message, 500)
  }

  return apiResponse({ success: true })
}
