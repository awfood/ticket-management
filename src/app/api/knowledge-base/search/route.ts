import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { query } = body

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { error: 'Campo query e obrigatorio' },
        { status: 400 }
      )
    }

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      return NextResponse.json(
        { error: 'Busca semantica nao configurada (OPENAI_API_KEY ausente)' },
        { status: 400 }
      )
    }

    // Generate embedding for the query
    const { generateEmbedding } = await import('@/lib/ai/similar-finder')
    const embedding = await generateEmbedding(query, openaiKey)

    // Search using pgvector cosine similarity via RPC
    const { data, error } = await supabase.rpc('match_knowledge_base_articles', {
      query_embedding: embedding,
      match_threshold: 0.6,
      match_count: 10,
    })

    if (error) {
      // Fallback to text search if RPC function doesn't exist
      if (error.message.includes('function') || error.code === '42883') {
        const { data: textResults, error: textError } = await supabase
          .from('knowledge_base_articles')
          .select(
            '*, author:profiles!knowledge_base_articles_created_by_fkey(id, full_name, avatar_url)'
          )
          .is('deleted_at', null)
          .eq('is_published', true)
          .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
          .order('updated_at', { ascending: false })
          .limit(10)

        if (textError) {
          return NextResponse.json(
            { error: 'Erro na busca de artigos' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          results: (textResults ?? []).map((a, i) => ({
            ...a,
            similarity: 1 - i * 0.05, // Approximate relevance ranking
          })),
          search_type: 'text',
        })
      }

      console.error('Error in semantic search:', error)
      return NextResponse.json(
        { error: 'Erro na busca semantica' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      results: data ?? [],
      search_type: 'semantic',
    })
  } catch (err) {
    console.error(
      'Unexpected error in POST /api/knowledge-base/search:',
      err
    )
    const message =
      err instanceof Error ? err.message : 'Erro interno do servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
