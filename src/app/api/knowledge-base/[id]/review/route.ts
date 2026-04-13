import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/knowledge-base/:id/review
 * Review an article (internal users only)
 *
 * Body: { status: 'approved' | 'rejected' | 'needs_edit' | 'pending_review', notes?: string }
 */
export async function POST(
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

    // Only internal users can review
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
    const { status, notes } = body

    const validStatuses = ['approved', 'rejected', 'needs_edit', 'pending_review']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Campo status obrigatorio. Valores: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // Save current version as revision before status change
    const { data: currentArticle } = await supabase
      .from('knowledge_base_articles')
      .select('title, content, content_html')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (!currentArticle) {
      return NextResponse.json({ error: 'Artigo nao encontrado' }, { status: 404 })
    }

    // Create revision record
    await supabase.from('knowledge_base_revisions').insert({
      article_id: id,
      title: currentArticle.title,
      content: currentArticle.content,
      content_html: currentArticle.content_html,
      changed_by: user.id,
      change_summary: `Review: ${status}${notes ? ` - ${notes}` : ''}`,
    })

    // Update article
    const updates: Record<string, unknown> = {
      review_status: status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }

    if (notes !== undefined) updates.review_notes = notes
    if (status === 'approved') updates.is_published = true
    if (status === 'rejected') updates.is_published = false

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
      return NextResponse.json(
        { error: 'Erro ao atualizar artigo' },
        { status: 500 }
      )
    }

    return NextResponse.json(article)
  } catch (err) {
    console.error('Error in POST /api/knowledge-base/[id]/review:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/knowledge-base/:id/review
 * Get review history (revisions) for an article
 */
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

    const { data: revisions, error } = await supabase
      .from('knowledge_base_revisions')
      .select('*, reviewer:profiles!knowledge_base_revisions_changed_by_fkey(id, full_name)')
      .eq('article_id', id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: 'Erro ao buscar revisoes' }, { status: 500 })
    }

    return NextResponse.json({ revisions: revisions ?? [] })
  } catch (err) {
    console.error('Error in GET /api/knowledge-base/[id]/review:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
