import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authenticateApiKey, requireScope, apiResponse, apiError } from '@/lib/api-keys'

/**
 * POST /api/v1/knowledge-base/bulk
 * Create multiple articles at once (for seeding/importing)
 *
 * Body: { articles: Array<{ title, content, content_html?, category?, tags?, slug?, sort_order?, is_published?, source?, review_status? }> }
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request)
  if (!auth.ok) return auth.response

  const scopeErr = requireScope(auth.context, 'kb.write')
  if (scopeErr) return scopeErr

  const body = await request.json()
  const { articles } = body

  if (!Array.isArray(articles) || articles.length === 0) {
    return apiError('VALIDATION_ERROR', 'Campo articles (array) obrigatorio e nao pode ser vazio', 400)
  }

  if (articles.length > 100) {
    return apiError('VALIDATION_ERROR', 'Maximo de 100 artigos por requisicao', 400)
  }

  const supabase = await createServiceClient()

  // Get the API key creator as author
  const { data: keyRecord } = await supabase
    .from('api_keys')
    .select('created_by')
    .eq('id', auth.context.keyId)
    .single()

  const createdBy = keyRecord?.created_by ?? null
  if (!createdBy) {
    return apiError('SYSTEM_ERROR', 'Nao foi possivel determinar o usuario criador', 500)
  }

  const validSources = ['manual', 'auto_generated', 'imported']
  const validReviewStatuses = ['pending_review', 'approved', 'rejected', 'needs_edit']

  // Validate and prepare all articles
  const preparedArticles = []
  const errors: string[] = []

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i]
    if (!a.title || !a.content) {
      errors.push(`Artigo ${i + 1}: title e content obrigatorios`)
      continue
    }

    const scoreVal = a.confidence_score !== undefined ? Math.max(0, Math.min(100, parseInt(a.confidence_score, 10))) : null

    preparedArticles.push({
      title: a.title,
      content: a.content,
      content_html: a.content_html ?? null,
      category: a.category ?? null,
      tags: a.tags ?? [],
      slug: a.slug ?? null,
      sort_order: a.sort_order ?? 0,
      is_published: a.is_published ?? false,
      source: a.source && validSources.includes(a.source) ? a.source : 'auto_generated',
      review_status: a.review_status && validReviewStatuses.includes(a.review_status) ? a.review_status : 'pending_review',
      confidence_score: isNaN(scoreVal as number) ? null : scoreVal,
      confidence_notes: a.confidence_notes ?? null,
      created_by: createdBy,
    })
  }

  if (preparedArticles.length === 0) {
    return apiError('VALIDATION_ERROR', `Nenhum artigo valido. Erros: ${errors.join('; ')}`, 400)
  }

  const { data: created, error } = await supabase
    .from('knowledge_base_articles')
    .insert(preparedArticles)
    .select('id, title, slug, category, review_status, source')

  if (error) {
    return apiError('CREATE_ERROR', error.message, 500)
  }

  return apiResponse({
    created: created?.length ?? 0,
    articles: created ?? [],
    errors: errors.length > 0 ? errors : undefined,
  }, 201)
}
