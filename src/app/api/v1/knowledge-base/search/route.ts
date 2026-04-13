import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authenticateApiKey, requireScope, apiResponse, apiError } from '@/lib/api-keys'

/**
 * POST /api/v1/knowledge-base/search
 * Search knowledge base articles (text search, semantic search requires OPENAI_API_KEY)
 *
 * Body: { query: string, category?: string, limit?: number }
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request)
  if (!auth.ok) return auth.response

  const scopeErr = requireScope(auth.context, 'kb.read')
  if (scopeErr) return scopeErr

  const body = await request.json()
  const { query, category, limit = 10 } = body

  if (!query || typeof query !== 'string') {
    return apiError('VALIDATION_ERROR', 'Campo query obrigatorio', 400)
  }

  const supabase = await createServiceClient()
  const maxResults = Math.min(50, Math.max(1, limit))

  // Try semantic search first
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    try {
      const { generateEmbedding } = await import('@/lib/ai/similar-finder')
      const embedding = await generateEmbedding(query, openaiKey)

      const { data: results, error } = await supabase.rpc(
        'match_knowledge_base_articles',
        {
          query_embedding: embedding,
          match_threshold: 0.5,
          match_count: maxResults,
        }
      )

      if (!error && results && results.length > 0) {
        // Filter by category if specified
        let filtered = results
        if (category) {
          filtered = results.filter((r: { category: string | null }) => r.category === category)
        }

        return apiResponse({
          results: filtered,
          search_type: 'semantic',
          total: filtered.length,
        })
      }
    } catch {
      // Fall through to text search
    }
  }

  // Fallback: text search
  let textQuery = supabase
    .from('knowledge_base_articles')
    .select('id, title, content, category, slug, tags, helpful_count, not_helpful_count, updated_at')
    .is('deleted_at', null)
    .eq('is_published', true)
    .or(`title.ilike.%${query}%,content.ilike.%${query}%`)

  if (category) {
    textQuery = textQuery.eq('category', category)
  }

  const { data: textResults, error: textError } = await textQuery
    .order('helpful_count', { ascending: false })
    .limit(maxResults)

  if (textError) return apiError('QUERY_ERROR', textError.message, 500)

  return apiResponse({
    results: textResults ?? [],
    search_type: 'text',
    total: textResults?.length ?? 0,
  })
}
