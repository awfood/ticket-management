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

    const { data: ticket, error } = await supabase
      .from('tickets')
      .select(
        '*, organization:organizations(id, name, slug, type), creator:profiles!tickets_created_by_fkey(id, full_name, avatar_url), assignee:profiles!tickets_assigned_to_fkey(id, full_name, avatar_url)'
      )
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !ticket) {
      return NextResponse.json(
        { error: 'Ticket nao encontrado' },
        { status: 404 }
      )
    }

    // Get comments count
    const { count: commentsCount } = await supabase
      .from('ticket_comments')
      .select('id', { count: 'exact', head: true })
      .eq('ticket_id', id)
      .is('deleted_at', null)

    return NextResponse.json({
      ...ticket,
      comments_count: commentsCount ?? 0,
    })
  } catch (err) {
    console.error('Unexpected error in GET /api/tickets/[id]:', err)
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

    const body = await request.json()

    // Fetch current ticket for history tracking
    const { data: currentTicket, error: fetchError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !currentTicket) {
      return NextResponse.json(
        { error: 'Ticket nao encontrado' },
        { status: 404 }
      )
    }

    // Allowed fields for update
    const allowedFields = [
      'title',
      'description',
      'status',
      'priority',
      'category',
      'assigned_to',
      'affected_service',
      'environment',
      'impact',
      'steps_to_reproduce',
      'expected_behavior',
      'actual_behavior',
      'tags',
      'due_date',
    ]

    const updates: Record<string, unknown> = {}
    const historyEntries: {
      ticket_id: string
      changed_by: string
      field_name: string
      old_value: string | null
      new_value: string | null
    }[] = []

    for (const field of allowedFields) {
      if (field in body && body[field] !== currentTicket[field]) {
        updates[field] = body[field]

        const oldVal = currentTicket[field]
        const newVal = body[field]
        historyEntries.push({
          ticket_id: id,
          changed_by: user.id,
          field_name: field,
          old_value: oldVal != null ? String(oldVal) : null,
          new_value: newVal != null ? String(newVal) : null,
        })
      }
    }

    // Handle status-specific timestamps
    if (updates.status === 'resolved') {
      updates.resolved_at = new Date().toISOString()
      updates.resolved_by = user.id
    } else if (updates.status === 'closed') {
      updates.closed_at = new Date().toISOString()
      updates.closed_by = user.id
    }

    // Track first response
    if (
      updates.status === 'in_progress' &&
      !currentTicket.first_response_at
    ) {
      updates.first_response_at = new Date().toISOString()
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(currentTicket)
    }

    updates.updated_at = new Date().toISOString()

    const { data: updatedTicket, error: updateError } = await supabase
      .from('tickets')
      .update(updates)
      .eq('id', id)
      .select(
        '*, organization:organizations(id, name, slug, type), creator:profiles!tickets_created_by_fkey(id, full_name, avatar_url), assignee:profiles!tickets_assigned_to_fkey(id, full_name, avatar_url)'
      )
      .single()

    if (updateError) {
      console.error('Error updating ticket:', updateError)
      return NextResponse.json(
        { error: 'Erro ao atualizar ticket' },
        { status: 500 }
      )
    }

    // Create history entries
    if (historyEntries.length > 0) {
      await supabase.from('ticket_history').insert(historyEntries)
    }

    // Send email notification on status change (fire-and-forget)
    if (updates.status && updates.status !== currentTicket.status) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      fetch(`${appUrl}/api/email/notify-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
        },
        body: JSON.stringify({
          ticket_id: id,
          old_status: currentTicket.status,
          new_status: updates.status,
          changed_by_id: user.id,
        }),
      }).catch((err) => console.error('[email] Erro ao notificar:', err))
    }

    return NextResponse.json(updatedTicket)
  } catch (err) {
    console.error('Unexpected error in PATCH /api/tickets/[id]:', err)
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

    // Soft delete
    const { error } = await supabase
      .from('tickets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)

    if (error) {
      console.error('Error deleting ticket:', error)
      return NextResponse.json(
        { error: 'Erro ao excluir ticket' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Ticket excluido com sucesso' })
  } catch (err) {
    console.error('Unexpected error in DELETE /api/tickets/[id]:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
