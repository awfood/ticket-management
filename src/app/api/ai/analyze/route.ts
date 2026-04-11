import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAIProvider } from '@/lib/ai/provider'
import { analyzeTicket } from '@/lib/ai/ticket-analyzer'
import { findSimilarTickets, generateEmbedding } from '@/lib/ai/similar-finder'
import { decrypt } from '@/lib/integrations/encryption'
import type { AIProvider } from '@/types'

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
    const { ticketId } = body

    if (!ticketId) {
      return NextResponse.json(
        { error: 'Campo ticketId e obrigatorio' },
        { status: 400 }
      )
    }

    // Fetch ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .is('deleted_at', null)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: 'Ticket nao encontrado' },
        { status: 404 }
      )
    }

    // Fetch AI settings
    const { data: aiSettings, error: settingsError } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (settingsError || !aiSettings) {
      return NextResponse.json(
        { error: 'Configuracoes de IA nao encontradas ou inativas' },
        { status: 400 }
      )
    }

    // Decrypt API key
    let apiKey: string
    try {
      apiKey = decrypt(aiSettings.api_key_encrypted)
    } catch {
      return NextResponse.json(
        { error: 'Erro ao descriptografar chave de API da IA' },
        { status: 500 }
      )
    }

    const provider = createAIProvider(
      aiSettings.provider as AIProvider,
      apiKey
    )

    // Get knowledge base context
    let knowledgeContext: string[] = []
    try {
      const openaiKey = process.env.OPENAI_API_KEY
      if (openaiKey) {
        const embeddingText = `${ticket.title}\n${ticket.description}`
        const embedding = await generateEmbedding(embeddingText, openaiKey)

        // Search knowledge base for relevant articles
        const { data: kbResults } = await supabase.rpc(
          'match_knowledge_base_articles',
          {
            query_embedding: embedding,
            match_threshold: 0.6,
            match_count: 3,
          }
        )

        if (kbResults && Array.isArray(kbResults)) {
          knowledgeContext = kbResults.map(
            (a: { title: string; content: string }) =>
              `${a.title}: ${a.content}`
          )
        }
      }
    } catch (kbErr) {
      console.error('Error fetching knowledge base context:', kbErr)
      // Non-fatal
    }

    // Find similar tickets
    let similarTickets: { title: string; resolution: string }[] = []
    try {
      const openaiKey = process.env.OPENAI_API_KEY
      if (openaiKey) {
        const embeddingText = `${ticket.title}\n${ticket.description}`
        const embedding = await generateEmbedding(embeddingText, openaiKey)

        // Store embedding on the ticket
        await supabase
          .from('tickets')
          .update({ embedding })
          .eq('id', ticketId)

        const similar = await findSimilarTickets(supabase, embedding, 5)
        const filteredSimilar = similar.filter((t) => t.id !== ticketId)

        if (filteredSimilar.length > 0) {
          // Fetch resolution info for similar tickets
          const { data: resolvedDetails } = await supabase
            .from('tickets')
            .select('id, title, description')
            .in(
              'id',
              filteredSimilar.map((t) => t.id)
            )
            .in('status', ['resolved', 'closed'])

          similarTickets = (resolvedDetails ?? []).map((t) => ({
            title: t.title,
            resolution: t.description ?? '',
          }))
        }
      }
    } catch (simErr) {
      console.error('Error finding similar tickets:', simErr)
      // Non-fatal
    }

    // Run analysis
    const analysis = await analyzeTicket(
      {
        title: ticket.title,
        description: ticket.description,
        category: ticket.category ?? undefined,
        affected_service: ticket.affected_service ?? undefined,
      },
      { provider, knowledgeContext, similarTickets }
    )

    // Store analysis result
    const { data: analysisResult, error: insertError } = await supabase
      .from('ai_analysis_results')
      .insert({
        ticket_id: ticketId,
        analysis_type: 'full_diagnosis',
        result: analysis as unknown as Record<string, unknown>,
        model_used: aiSettings.default_model ?? aiSettings.provider,
        tokens_used: null,
        cost_usd: null,
        created_by: user.id,
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('Error storing analysis result:', insertError)
    }

    return NextResponse.json({
      analysis,
      analysis_id: analysisResult?.id ?? null,
    })
  } catch (err) {
    console.error('Unexpected error in POST /api/ai/analyze:', err)
    const message =
      err instanceof Error ? err.message : 'Erro interno do servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
