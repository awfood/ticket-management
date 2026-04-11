import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { PaginatedResponse, KnowledgeBaseArticle } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') ?? ''
    const category = searchParams.get('category')
    const published = searchParams.get('published')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const perPage = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('per_page') ?? '20', 10))
    )
    const offset = (page - 1) * perPage

    let query = supabase
      .from('knowledge_base_articles')
      .select(
        '*, author:profiles!knowledge_base_articles_created_by_fkey(id, full_name, avatar_url)',
        { count: 'exact' }
      )
      .is('deleted_at', null)

    // Text search
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,content.ilike.%${search}%`
      )
    }

    // Category filter
    if (category) {
      query = query.eq('category', category)
    }

    // Published filter
    if (published === 'true') {
      query = query.eq('is_published', true)
    } else if (published === 'false') {
      query = query.eq('is_published', false)
    }

    // Check if user is internal to decide visibility
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_internal')
      .eq('id', user.id)
      .single()

    if (!profile?.is_internal) {
      // External users see only published articles
      query = query.eq('is_published', true)
    }

    query = query
      .order('updated_at', { ascending: false })
      .range(offset, offset + perPage - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching KB articles:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar artigos' },
        { status: 500 }
      )
    }

    const total = count ?? 0
    const response: PaginatedResponse<KnowledgeBaseArticle> = {
      data: data ?? [],
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('Unexpected error in GET /api/knowledge-base:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    // Only internal users can create articles
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_internal')
      .eq('id', user.id)
      .single()

    if (!profile?.is_internal) {
      return NextResponse.json(
        { error: 'Acesso restrito a usuarios internos' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      title,
      content,
      content_html,
      category,
      tags,
      is_published,
    } = body

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Titulo e conteudo sao obrigatorios' },
        { status: 400 }
      )
    }

    const { data: article, error } = await supabase
      .from('knowledge_base_articles')
      .insert({
        title,
        content,
        content_html: content_html ?? null,
        category: category ?? null,
        tags: tags ?? [],
        is_published: is_published ?? false,
        created_by: user.id,
      })
      .select(
        '*, author:profiles!knowledge_base_articles_created_by_fkey(id, full_name, avatar_url)'
      )
      .single()

    if (error) {
      console.error('Error creating KB article:', error)
      return NextResponse.json(
        { error: 'Erro ao criar artigo' },
        { status: 500 }
      )
    }

    // Try to generate embedding in the background
    try {
      const openaiKey = process.env.OPENAI_API_KEY
      if (openaiKey) {
        const { generateEmbedding } = await import(
          '@/lib/ai/similar-finder'
        )
        const embeddingText = `${title}\n${content}`
        const embedding = await generateEmbedding(embeddingText, openaiKey)

        await supabase
          .from('knowledge_base_articles')
          .update({ embedding })
          .eq('id', article.id)
      }
    } catch (embErr) {
      console.error('Error generating article embedding:', embErr)
      // Non-fatal
    }

    return NextResponse.json(article, { status: 201 })
  } catch (err) {
    console.error('Unexpected error in POST /api/knowledge-base:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
