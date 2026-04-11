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

    const { data: comments, error } = await supabase
      .from('ticket_comments')
      .select(
        '*, author:profiles!ticket_comments_author_id_fkey(id, full_name, avatar_url, is_internal), parent_comment_id'
      )
      .eq('ticket_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    // Build parent comment references from the same result set
    const commentsList = comments ?? []
    const commentMap = new Map(commentsList.map((c) => [c.id, c]))
    const enriched = commentsList.map((c) => {
      if (c.parent_comment_id && commentMap.has(c.parent_comment_id)) {
        const parent = commentMap.get(c.parent_comment_id)!
        return {
          ...c,
          parent_comment: {
            id: parent.id,
            body: parent.body,
            author: parent.author,
          },
        }
      }
      return { ...c, parent_comment: null }
    })

    if (error) {
      console.error('Error fetching comments:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar comentarios' },
        { status: 500 }
      )
    }

    return NextResponse.json(enriched)
  } catch (err) {
    console.error('Unexpected error in GET /api/tickets/[id]/comments:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

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
    const { body: commentBody, body_html, is_internal = false, comment_type = 'reply', parent_comment_id } = body

    if (!commentBody?.trim()) {
      return NextResponse.json(
        { error: 'Corpo do comentario e obrigatorio' },
        { status: 400 }
      )
    }

    // Verify ticket exists
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, status, first_response_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: 'Ticket nao encontrado' },
        { status: 404 }
      )
    }

    const { data: comment, error } = await supabase
      .from('ticket_comments')
      .insert({
        ticket_id: id,
        author_id: user.id,
        body: commentBody,
        body_html: body_html || null,
        is_internal,
        comment_type,
        parent_comment_id: parent_comment_id || null,
        metadata: {},
      })
      .select(
        '*, author:profiles!ticket_comments_author_id_fkey(id, full_name, avatar_url, is_internal)'
      )
      .single()

    if (error) {
      console.error('Error creating comment:', error)
      return NextResponse.json(
        { error: 'Erro ao criar comentario' },
        { status: 500 }
      )
    }

    // Track first response if this is a reply from internal team
    if (!ticket.first_response_at && comment_type === 'reply') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_internal')
        .eq('id', user.id)
        .single()

      if (profile?.is_internal) {
        await supabase
          .from('tickets')
          .update({ first_response_at: new Date().toISOString() })
          .eq('id', id)
      }
    }

    // Update ticket updated_at
    await supabase
      .from('tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json(comment, { status: 201 })
  } catch (err) {
    console.error('Unexpected error in POST /api/tickets/[id]/comments:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
