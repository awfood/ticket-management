import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const { data: article, error } = await supabase
      .from('knowledge_base_articles')
      .select(
        '*, author:profiles!knowledge_base_articles_created_by_fkey(id, full_name, avatar_url)'
      )
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !article) {
      return NextResponse.json(
        { error: 'Artigo nao encontrado' },
        { status: 404 }
      )
    }

    // Non-internal users can only see published articles
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_internal')
      .eq('id', user.id)
      .single()

    if (!profile?.is_internal && !article.is_published) {
      return NextResponse.json(
        { error: 'Artigo nao encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(article)
  } catch (err) {
    console.error('Unexpected error in GET /api/knowledge-base/[id]:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    // Only internal users can edit
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

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {}
    if (title !== undefined) updates.title = title
    if (content !== undefined) updates.content = content
    if (content_html !== undefined) updates.content_html = content_html
    if (category !== undefined) updates.category = category
    if (tags !== undefined) updates.tags = tags
    if (is_published !== undefined) updates.is_published = is_published

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Nenhum campo para atualizar' },
        { status: 400 }
      )
    }

    const { data: article, error } = await supabase
      .from('knowledge_base_articles')
      .update(updates)
      .eq('id', id)
      .is('deleted_at', null)
      .select(
        '*, author:profiles!knowledge_base_articles_created_by_fkey(id, full_name, avatar_url)'
      )
      .single()

    if (error || !article) {
      console.error('Error updating KB article:', error)
      return NextResponse.json(
        { error: 'Erro ao atualizar artigo' },
        { status: 500 }
      )
    }

    // Regenerate embedding if content changed
    if (content !== undefined || title !== undefined) {
      try {
        const openaiKey = process.env.OPENAI_API_KEY
        if (openaiKey) {
          const { generateEmbedding } = await import(
            '@/lib/ai/similar-finder'
          )
          const embeddingText = `${article.title}\n${article.content}`
          const embedding = await generateEmbedding(embeddingText, openaiKey)

          await supabase
            .from('knowledge_base_articles')
            .update({ embedding })
            .eq('id', id)
        }
      } catch (embErr) {
        console.error('Error regenerating article embedding:', embErr)
        // Non-fatal
      }
    }

    return NextResponse.json(article)
  } catch (err) {
    console.error('Unexpected error in PATCH /api/knowledge-base/[id]:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    // Only internal users can delete
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

    // Soft delete
    const { error } = await supabase
      .from('knowledge_base_articles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)

    if (error) {
      console.error('Error deleting KB article:', error)
      return NextResponse.json(
        { error: 'Erro ao excluir artigo' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Unexpected error in DELETE /api/knowledge-base/[id]:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
