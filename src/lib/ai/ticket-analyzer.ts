// ============================================================
// Ticket Analysis Engine
// ============================================================

import type { AIProviderClient } from '@/lib/ai/provider'
import type { TicketCategory, TicketPriority, AffectedService } from '@/types'

export interface TicketAnalysis {
  diagnosis: string
  possibleCauses: string[]
  suggestedActions: {
    forClient: string[]
    forDevelopment: string[]
  }
  suggestedCategory: TicketCategory
  suggestedPriority: TicketPriority
  suggestedService: AffectedService
  confidence: number
}

interface TicketInput {
  title: string
  description: string
  category?: string
  affected_service?: string
  comments?: { author: string; body: string; created_at: string; is_internal: boolean }[]
  previousAnalysis?: string
}

interface AnalyzeOptions {
  provider: AIProviderClient
  knowledgeContext?: string[]
  similarTickets?: { title: string; resolution: string }[]
}

export interface CommentAnalysis {
  summary: string
  actionItems: string[]
  technicalInsights: string[]
  suggestedResponse: string | null
  relatedToOriginalIssue: boolean
  newInformation: string[]
}

const MAX_CONTEXT_CHARS = 12_000 // ~3000 tokens

const SYSTEM_PROMPT = `Voce e um assistente de analise de tickets de suporte da plataforma AWFood.
A AWFood e uma plataforma SaaS de delivery para restaurantes no mercado brasileiro.

Servicos da plataforma:
- painel: Painel de gestao do restaurante (Laravel 5.6) - cardapio, pedidos, financeiro, integracoes, NFCe/NFe
- pdv: Ponto de Venda em tempo real com WebSocket (Laravel 5.6) - gestao de pedidos, impressao, caixa
- api: API externa (Laravel 5.6) - apps mobile, webhooks, integracoes marketplace
- admin: Back-office (Laravel 5.6) - cobranca, CRM, revendedores, dark kitchens
- site: App PWA do cliente (Angular 11/Ionic 5) - cardapio online, pedidos, pagamentos

Integracoes de marketplace: iFood, Rappi, UberEats, AnotaAi, CardapioWeb, Accon, DeliveryDireto, Keeta, 99Food
Gateways de pagamento: Stripe, MercadoPago, PagSeguro, Cielo
Fiscal: NFCe, NFe (via Focus NFe)
Infraestrutura: MySQL 8.0 multi-tenant (um banco por restaurante), Redis 6.2, PHP 7.4, Node.js 22

Problemas comuns incluem:
- Timeout de conexao com banco de dados em horarios de pico
- Falhas de sincronizacao com marketplaces (iFood, Rappi)
- Emissao de NFCe com dados fiscais invalidos (ICMS, CFOP)
- Problemas de impressao termica no PDV
- Erros de importacao de cardapio
- Lentidao no painel com muitos pedidos simultaneos
- Falhas em webhooks de integracao
- Problemas de WebSocket no PDV (desconexao, pedidos nao aparecem)

Voce deve analisar o ticket e retornar um JSON valido (sem markdown) com a seguinte estrutura:
{
  "diagnosis": "descricao concisa do problema identificado",
  "possibleCauses": ["causa 1", "causa 2"],
  "suggestedActions": {
    "forClient": ["acao sugerida para o cliente"],
    "forDevelopment": ["acao sugerida para desenvolvimento"]
  },
  "suggestedCategory": "bug|feature_request|support|billing|integration|configuration",
  "suggestedPriority": "critical|high|medium|low",
  "suggestedService": "painel|pdv|api|admin|site",
  "confidence": 0.85
}

Regras:
- Responda APENAS com o JSON, sem texto adicional nem blocos de codigo
- confidence e um numero entre 0 e 1
- suggestedCategory deve ser um dos valores listados
- suggestedPriority deve ser um dos valores listados
- suggestedService deve ser um dos valores listados
- Todas as descricoes devem ser em portugues`

/**
 * Analyzes a support ticket and returns structured diagnosis with
 * suggested classification and actions.
 */
export async function analyzeTicket(
  ticket: TicketInput,
  options: AnalyzeOptions
): Promise<TicketAnalysis> {
  const { provider, knowledgeContext, similarTickets } = options

  const userPrompt = buildUserPrompt(ticket, knowledgeContext, similarTickets)

  const response = await provider.chat(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    { maxTokens: 1024, temperature: 0.2 }
  )

  return parseAnalysisResponse(response.content)
}

function buildUserPrompt(
  ticket: TicketInput,
  knowledgeContext?: string[],
  similarTickets?: { title: string; resolution: string }[]
): string {
  const parts: string[] = []

  // Main ticket info
  parts.push(`## Ticket para analise`)
  parts.push(`Titulo: ${ticket.title}`)
  parts.push(`Descricao: ${ticket.description}`)
  if (ticket.category) {
    parts.push(`Categoria informada: ${ticket.category}`)
  }
  if (ticket.affected_service) {
    parts.push(`Servico afetado informado: ${ticket.affected_service}`)
  }

  // Include conversation history (comments)
  if (ticket.comments?.length) {
    parts.push('\n## Historico de comentarios')
    for (const comment of ticket.comments) {
      const prefix = comment.is_internal ? '[INTERNO]' : '[CLIENTE]'
      const body = comment.body.slice(0, 500)
      parts.push(`${prefix} ${comment.author} (${comment.created_at}): ${body}`)
    }
  }

  // Include previous analysis for incremental context
  if (ticket.previousAnalysis) {
    parts.push(`\n## Analise anterior`)
    parts.push(ticket.previousAnalysis.slice(0, 800))
  }

  let currentLength = parts.join('\n').length

  // Add knowledge context (trimmed to fit budget)
  if (knowledgeContext?.length) {
    parts.push('\n## Artigos da base de conhecimento relevantes')
    for (const article of knowledgeContext) {
      const trimmed = article.slice(0, 500)
      if (currentLength + trimmed.length > MAX_CONTEXT_CHARS) break
      parts.push(`- ${trimmed}`)
      currentLength += trimmed.length
    }
  }

  // Add similar tickets (trimmed to fit budget)
  if (similarTickets?.length) {
    parts.push('\n## Tickets similares anteriores')
    for (const similar of similarTickets) {
      const entry = `- ${similar.title}: ${similar.resolution.slice(0, 300)}`
      if (currentLength + entry.length > MAX_CONTEXT_CHARS) break
      parts.push(entry)
      currentLength += entry.length
    }
  }

  parts.push('\nAnalise o ticket acima e retorne o JSON de diagnostico.')

  return parts.join('\n')
}

function parseAnalysisResponse(raw: string): TicketAnalysis {
  // Strip markdown code fences if the model wraps the JSON
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(
      `Failed to parse AI analysis response as JSON. Raw response: ${raw.slice(0, 200)}`
    )
  }

  const validCategories = [
    'bug',
    'feature_request',
    'support',
    'billing',
    'integration',
    'configuration',
  ]
  const validPriorities = ['critical', 'high', 'medium', 'low']
  const validServices = ['painel', 'pdv', 'api', 'admin', 'site']

  const suggestedCategory = validCategories.includes(
    parsed.suggestedCategory as string
  )
    ? (parsed.suggestedCategory as TicketCategory)
    : 'support'

  const suggestedPriority = validPriorities.includes(
    parsed.suggestedPriority as string
  )
    ? (parsed.suggestedPriority as TicketPriority)
    : 'medium'

  const suggestedService = validServices.includes(
    parsed.suggestedService as string
  )
    ? (parsed.suggestedService as AffectedService)
    : 'painel'

  const actions = parsed.suggestedActions as {
    forClient?: unknown[]
    forDevelopment?: unknown[]
  } | null

  return {
    diagnosis: String(parsed.diagnosis ?? 'Analise indisponivel'),
    possibleCauses: Array.isArray(parsed.possibleCauses)
      ? parsed.possibleCauses.map(String)
      : [],
    suggestedActions: {
      forClient: Array.isArray(actions?.forClient)
        ? actions.forClient.map(String)
        : [],
      forDevelopment: Array.isArray(actions?.forDevelopment)
        ? actions.forDevelopment.map(String)
        : [],
    },
    suggestedCategory,
    suggestedPriority,
    suggestedService,
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
  }
}

// ============================================================
// Analyze a specific comment in context of the ticket
// ============================================================

const COMMENT_ANALYSIS_PROMPT = `Voce e um assistente de analise de suporte da plataforma AWFood.
Analise o comentario especifico no contexto do ticket e retorne um JSON valido com:
{
  "summary": "resumo do que o comentario informa",
  "actionItems": ["acao necessaria baseada neste comentario"],
  "technicalInsights": ["insight tecnico extraido do comentario"],
  "suggestedResponse": "sugestao de resposta ao cliente (null se nao aplicavel)",
  "relatedToOriginalIssue": true,
  "newInformation": ["informacao nova que este comentario traz"]
}

Regras:
- Responda APENAS com o JSON, sem texto adicional
- Se o comentario contem logs de erro, extraia os detalhes tecnicos
- Se o comentario descreve novo comportamento, indique se muda o diagnostico
- suggestedResponse deve ser em portugues e profissional
- Todas as descricoes em portugues`

export async function analyzeComment(
  ticket: { title: string; description: string; status: string },
  comment: { body: string; author: string; is_internal: boolean },
  previousComments: { author: string; body: string }[],
  provider: AIProviderClient
): Promise<CommentAnalysis> {
  const parts: string[] = []
  parts.push(`## Ticket: ${ticket.title}`)
  parts.push(`Status: ${ticket.status}`)
  parts.push(`Descricao: ${ticket.description.slice(0, 500)}`)

  if (previousComments.length > 0) {
    parts.push('\n## Comentarios anteriores (resumo)')
    for (const c of previousComments.slice(-5)) {
      parts.push(`- ${c.author}: ${c.body.slice(0, 200)}`)
    }
  }

  parts.push(`\n## Comentario para analisar`)
  parts.push(`Autor: ${comment.author} (${comment.is_internal ? 'equipe interna' : 'cliente'})`)
  parts.push(`Conteudo: ${comment.body}`)

  const response = await provider.chat(
    [
      { role: 'system', content: COMMENT_ANALYSIS_PROMPT },
      { role: 'user', content: parts.join('\n') },
    ],
    { maxTokens: 768, temperature: 0.2 }
  )

  let cleaned = response.content.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  try {
    const parsed = JSON.parse(cleaned)
    return {
      summary: String(parsed.summary ?? ''),
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.map(String) : [],
      technicalInsights: Array.isArray(parsed.technicalInsights) ? parsed.technicalInsights.map(String) : [],
      suggestedResponse: parsed.suggestedResponse ? String(parsed.suggestedResponse) : null,
      relatedToOriginalIssue: parsed.relatedToOriginalIssue !== false,
      newInformation: Array.isArray(parsed.newInformation) ? parsed.newInformation.map(String) : [],
    }
  } catch {
    return {
      summary: response.content.slice(0, 200),
      actionItems: [],
      technicalInsights: [],
      suggestedResponse: null,
      relatedToOriginalIssue: true,
      newInformation: [],
    }
  }
}
