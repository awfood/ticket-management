import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authenticateApiKey, requireScope, apiResponse, apiError } from '@/lib/api-keys'

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request)
  if (!auth.ok) return auth.response

  const scopeErr = requireScope(auth.context, 'kb.read')
  if (scopeErr) return scopeErr

  const supabase = await createServiceClient()
  const { searchParams } = request.nextUrl

  const search = searchParams.get('search')
  const category = searchParams.get('category')
  const reviewStatus = searchParams.get('review_status')
  const published = searchParams.get('published')
  const source = searchParams.get('source')
  const minScore = searchParams.get('min_score')
  const maxScore = searchParams.get('max_score')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') ?? '20', 10)))

  let query = supabase
    .from('knowledge_base_articles')
    .select(
      'id, title, content, content_html, category, tags, slug, sort_order, is_published, review_status, review_notes, reviewed_at, source, helpful_count, not_helpful_count, confidence_score, confidence_notes, created_by, created_at, updated_at',
      { count: 'exact' }
    )
    .is('deleted_at', null)

  if (search) {
    query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`)
  }
  if (category) query = query.eq('category', category)
  if (reviewStatus) query = query.eq('review_status', reviewStatus)
  if (source) query = query.eq('source', source)
  if (published === 'true') query = query.eq('is_published', true)
  else if (published === 'false') query = query.eq('is_published', false)
  if (minScore) query = query.gte('confidence_score', parseInt(minScore, 10))
  if (maxScore) query = query.lte('confidence_score', parseInt(maxScore, 10))

  const { data, error, count } = await query
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1)

  if (error) return apiError('QUERY_ERROR', error.message, 500)

  return apiResponse({
    articles: data ?? [],
    total: count ?? 0,
    page,
    per_page: perPage,
  })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request)
  if (!auth.ok) return auth.response

  const scopeErr = requireScope(auth.context, 'kb.write')
  if (scopeErr) return scopeErr

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
    source,
    review_status,
    confidence_score,
    confidence_notes,
  } = body

  if (!title || !content) {
    return apiError('VALIDATION_ERROR', 'Campos title e content obrigatorios', 400)
  }

  const supabase = await createServiceClient()

  // Get the API key creator as author
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

  const validCategories = [
    'geral', 'integracao', 'fiscal', 'pagamento', 'cardapio',
    'pedidos', 'configuracao', 'troubleshooting', 'pdv', 'estoque',
    'financeiro', 'cadastros', 'promocoes', 'relatorios', 'delivery'
  ]

  const validReviewStatuses = ['pending_review', 'approved', 'rejected', 'needs_edit']
  const validSources = ['manual', 'auto_generated', 'imported']

  const scoreVal = confidence_score !== undefined ? Math.max(0, Math.min(100, parseInt(confidence_score, 10))) : null

  const { data: article, error } = await supabase
    .from('knowledge_base_articles')
    .insert({
      title,
      content,
      content_html: content_html ?? null,
      category: category && validCategories.includes(category) ? category : null,
      tags: tags ?? [],
      slug: slug ?? null,
      sort_order: sort_order ?? 0,
      is_published: is_published ?? false,
      source: source && validSources.includes(source) ? source : 'manual',
      review_status: review_status && validReviewStatuses.includes(review_status) ? review_status : 'pending_review',
      confidence_score: isNaN(scoreVal as number) ? null : scoreVal,
      confidence_notes: confidence_notes ?? null,
      created_by: createdBy,
    })
    .select('id, title, slug, category, is_published, review_status, source, confidence_score, created_at')
    .single()

  if (error) return apiError('CREATE_ERROR', error.message, 500)

  return apiResponse(article, 201)
}
