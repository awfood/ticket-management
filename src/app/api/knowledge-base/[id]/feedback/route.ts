import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/knowledge-base/:id/feedback
 * Submit feedback (helpful/not helpful) for an article
 * Available to any authenticated user
 *
 * Body: { is_helpful: boolean, comment?: string }
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

    const body = await request.json()
    const { is_helpful, comment } = body

    if (typeof is_helpful !== 'boolean') {
      return NextResponse.json(
        { error: 'Campo is_helpful (boolean) obrigatorio' },
        { status: 400 }
      )
    }

    // Verify article exists and is published
    const { data: article } = await supabase
      .from('knowledge_base_articles')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (!article) {
      return NextResponse.json({ error: 'Artigo nao encontrado' }, { status: 404 })
    }

    // Insert feedback
    const { error: feedbackError } = await supabase
      .from('knowledge_base_feedback')
      .insert({
        article_id: id,
        is_helpful,
        comment: comment ?? null,
        user_identifier: user.id,
      })

    if (feedbackError) {
      return NextResponse.json(
        { error: 'Erro ao salvar feedback' },
        { status: 500 }
      )
    }

    // Update counters
    const counterField = is_helpful ? 'helpful_count' : 'not_helpful_count'
    const { data: current } = await supabase
      .from('knowledge_base_articles')
      .select('helpful_count, not_helpful_count')
      .eq('id', id)
      .single()

    if (current) {
      await supabase
        .from('knowledge_base_articles')
        .update({ [counterField]: ((current[counterField] as number) ?? 0) + 1 })
        .eq('id', id)
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error('Error in POST /api/knowledge-base/[id]/feedback:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/knowledge-base/:id/feedback
 * Get feedback summary (internal users only)
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

    const { data: feedback, error } = await supabase
      .from('knowledge_base_feedback')
      .select('*')
      .eq('article_id', id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: 'Erro ao buscar feedback' }, { status: 500 })
    }

    const helpful = feedback?.filter(f => f.is_helpful).length ?? 0
    const notHelpful = feedback?.filter(f => !f.is_helpful).length ?? 0

    return NextResponse.json({
      article_id: id,
      helpful,
      not_helpful: notHelpful,
      total: feedback?.length ?? 0,
      feedback: feedback ?? [],
    })
  } catch (err) {
    console.error('Error in GET /api/knowledge-base/[id]/feedback:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
