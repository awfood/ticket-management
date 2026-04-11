// ============================================================
// RAG Response Suggester
// ============================================================

import type { AIProviderClient } from '@/lib/ai/provider'

export interface SuggestedResponse {
  response: string
  internalNotes: string | null
  sources: { type: 'knowledge_base' | 'similar_ticket'; title: string; id: string }[]
  tokensUsed: number
}

interface TicketInput {
  title: string
  description: string
  comments?: string[]
}

interface ResponseContext {
  knowledgeArticles: string[]
  similarResolutions: string[]
}

const MAX_CONTEXT_CHARS = 12_000 // ~3000 tokens

const SYSTEM_PROMPT = `Voce e um assistente de suporte da plataforma AWFood, uma plataforma SaaS de delivery para restaurantes no mercado brasileiro.

Sua tarefa e gerar uma resposta util e profissional para o ticket de suporte, usando o contexto fornecido (artigos da base de conhecimento e resolucoes de tickets similares).

Regras:
- Responda em portugues brasileiro
- Seja educado, direto e profissional
- Use o contexto fornecido para embasar sua resposta
- Se o contexto nao for suficiente para uma resposta completa, indique isso e sugira proximos passos
- Nao invente informacoes que nao estejam no contexto
- Retorne um JSON valido (sem markdown) com a seguinte estrutura:
{
  "response": "texto da resposta para o cliente",
  "internalNotes": "notas tecnicas internas para a equipe de suporte (ou null se nao aplicavel)",
  "sources": [
    { "type": "knowledge_base", "title": "titulo do artigo", "id": "id_do_artigo" },
    { "type": "similar_ticket", "title": "titulo do ticket", "id": "id_do_ticket" }
  ]
}

Diretrizes para a resposta ao cliente:
- Cumprimente o cliente
- Reconheca o problema reportado
- Apresente a solucao ou orientacao baseada no contexto
- Ofereca ajuda adicional
- Mantenha um tom amigavel

Diretrizes para notas internas:
- Inclua detalhes tecnicos relevantes
- Mencione servicos/componentes afetados (painel, pdv, api, admin, site)
- Sugira acoes de investigacao se necessario
- Retorne null se nao houver informacoes tecnicas adicionais relevantes`

/**
 * Generates a suggested response for a support ticket using RAG
 * (Retrieval-Augmented Generation) with knowledge base articles
 * and similar ticket resolutions as context.
 */
export async function suggestResponse(
  ticket: TicketInput,
  context: ResponseContext,
  provider: AIProviderClient
): Promise<SuggestedResponse> {
  const userPrompt = buildRAGPrompt(ticket, context)

  const result = await provider.chat(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    { maxTokens: 1024, temperature: 0.4 }
  )

  const totalTokens = result.tokensUsed.input + result.tokensUsed.output

  return parseResponseResult(result.content, totalTokens)
}

function buildRAGPrompt(
  ticket: TicketInput,
  context: ResponseContext
): string {
  const parts: string[] = []

  // Ticket info
  parts.push('## Ticket de suporte')
  parts.push(`Titulo: ${ticket.title}`)
  parts.push(`Descricao: ${ticket.description}`)

  let currentLength = parts.join('\n').length

  // Conversation history (trimmed)
  if (ticket.comments?.length) {
    parts.push('\n## Historico de comentarios')
    for (const comment of ticket.comments.slice(-5)) {
      const trimmed = comment.slice(0, 400)
      if (currentLength + trimmed.length > MAX_CONTEXT_CHARS) break
      parts.push(`- ${trimmed}`)
      currentLength += trimmed.length
    }
  }

  // Knowledge base articles (trimmed)
  if (context.knowledgeArticles.length > 0) {
    parts.push('\n## Artigos da base de conhecimento')
    for (let i = 0; i < context.knowledgeArticles.length; i++) {
      const article = context.knowledgeArticles[i]
      const trimmed = article.slice(0, 600)
      if (currentLength + trimmed.length > MAX_CONTEXT_CHARS) break
      parts.push(`[KB-${i}] ${trimmed}`)
      currentLength += trimmed.length
    }
  }

  // Similar resolutions (trimmed)
  if (context.similarResolutions.length > 0) {
    parts.push('\n## Resolucoes de tickets similares')
    for (let i = 0; i < context.similarResolutions.length; i++) {
      const resolution = context.similarResolutions[i]
      const trimmed = resolution.slice(0, 500)
      if (currentLength + trimmed.length > MAX_CONTEXT_CHARS) break
      parts.push(`[ST-${i}] ${trimmed}`)
      currentLength += trimmed.length
    }
  }

  parts.push(
    '\nCom base no contexto acima, gere uma resposta para o cliente e notas internas se aplicavel. Retorne o JSON.'
  )

  return parts.join('\n')
}

function parseResponseResult(
  raw: string,
  tokensUsed: number
): SuggestedResponse {
  // Strip markdown code fences if the model wraps the JSON
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    // If parsing fails, treat the raw text as the response
    return {
      response: raw,
      internalNotes: null,
      sources: [],
      tokensUsed,
    }
  }

  const sources = Array.isArray(parsed.sources)
    ? (parsed.sources as Array<Record<string, unknown>>)
        .filter(
          (s) =>
            (s.type === 'knowledge_base' || s.type === 'similar_ticket') &&
            typeof s.title === 'string' &&
            typeof s.id === 'string'
        )
        .map((s) => ({
          type: s.type as 'knowledge_base' | 'similar_ticket',
          title: String(s.title),
          id: String(s.id),
        }))
    : []

  return {
    response: String(parsed.response ?? raw),
    internalNotes:
      parsed.internalNotes != null ? String(parsed.internalNotes) : null,
    sources,
    tokensUsed,
  }
}
