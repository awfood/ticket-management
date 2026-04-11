import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { findSimilarTickets, generateEmbedding } from '@/lib/ai/similar-finder'

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
    const { text, ticketId } = body

    if (!text && !ticketId) {
      return NextResponse.json(
        { error: 'Campo text ou ticketId e obrigatorio' },
        { status: 400 }
      )
    }

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      return NextResponse.json(
        { error: 'Busca de tickets similares nao configurada (OPENAI_API_KEY ausente)' },
        { status: 400 }
      )
    }

    let embeddingText: string

    if (ticketId) {
      // Get ticket text
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .select('title, description')
        .eq('id', ticketId)
        .is('deleted_at', null)
        .single()

      if (ticketError || !ticket) {
        return NextResponse.json(
          { error: 'Ticket nao encontrado' },
          { status: 404 }
        )
      }

      embeddingText = `${ticket.title}\n${ticket.description}`
    } else {
      embeddingText = text
    }

    const embedding = await generateEmbedding(embeddingText, openaiKey)
    let similar = await findSimilarTickets(supabase, embedding, 10)

    // Exclude the source ticket if searching by ticketId
    if (ticketId) {
      similar = similar.filter((t) => t.id !== ticketId)
    }

    return NextResponse.json({
      similar_tickets: similar,
    })
  } catch (err) {
    console.error('Unexpected error in POST /api/ai/similar:', err)
    const message =
      err instanceof Error ? err.message : 'Erro interno do servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
