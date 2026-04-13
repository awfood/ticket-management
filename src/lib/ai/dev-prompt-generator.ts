// ============================================================
// Dev Prompt Generator
// Generates structured prompts for Claude Code / AI coding tools
// based on ticket context + AWFood platform knowledge
// ============================================================

import type { AIProviderClient } from '@/lib/ai/provider'

export interface DevPromptResult {
  prompt: string
  context_summary: string
  affected_files: string[]
  approach_steps: string[]
  test_suggestions: string[]
  model_used: string
  tokens_used: number
}

export interface DevPromptOptions {
  /** Observacoes extras do desenvolvedor para incluir no prompt */
  extra_notes?: string
  /** Se true, a IA de destino ja conhece a plataforma — reduz contexto de arquitetura */
  ai_has_context?: boolean
}

interface TicketContext {
  ticket_number: string
  title: string
  description: string
  category: string | null
  affected_service: string | null
  environment: string | null
  impact: string | null
  steps_to_reproduce: string | null
  expected_behavior: string | null
  actual_behavior: string | null
  comments: { author: string; body: string; is_internal: boolean }[]
  previousAnalysis?: string
}

// System prompt COMPLETO — inclui toda a arquitetura para IAs sem contexto previo
const SYSTEM_PROMPT_FULL = `Voce e um engenheiro senior da plataforma AWFood. Sua tarefa e gerar um prompt de desenvolvimento estruturado que sera usado no Claude Code ou outra ferramenta de IA para implementar a solucao de um ticket de suporte.

A plataforma AWFood tem a seguinte arquitetura:
- admin/: Laravel 5.6 — Back-office: billing, CRM, revendedores. Port 9005
- painel/: Laravel 5.6 — Gestao do restaurante (servico principal). Port 9001
- pdv/: Laravel 5.6 — Ponto de Venda em tempo real com WebSocket. Port 9002
- api/: Laravel 5.6 — API externa: apps mobile, webhooks, marketplaces. Port 9003
- site/: Angular 11/Ionic 5 — App PWA de delivery. Port 9004

Infraestrutura: MySQL 8.0 multi-tenant (um banco por restaurante: awfood_{slug}), Redis 6.2, PHP 7.4, Node.js 22
Multi-tenant: DB::set('slug') para trocar banco. Middleware CheckBusiness faz isso automaticamente em HTTP.
Models usam UUID (UuidModelTrait), SoftDeletes, namespace App\\ (nao App\\Models\\).
Observers em AppServiceProvider causam side-effects (sync integracao, broadcast WebSocket).

Integracoes: iFood, Rappi, UberEats, AnotaAi, CardapioWeb, 99Food, Keeta
Pagamentos: Stripe, MercadoPago, PagSeguro, Cielo
Fiscal: NFCe/NFe via Focus NFe
Storage: S3 (DigitalOcean Spaces)

Voce deve gerar um JSON valido com:
{
  "prompt": "O prompt completo formatado em markdown que sera copiado para o Claude Code. Deve incluir: contexto do problema, arquivos relevantes, abordagem sugerida, restricoes tecnicas, e instrucoes claras de implementacao.",
  "context_summary": "Resumo de 2-3 frases do problema para contexto rapido",
  "affected_files": ["lista/de/arquivos/provavelmente/afetados.php"],
  "approach_steps": ["Passo 1: ...", "Passo 2: ..."],
  "test_suggestions": ["Testar cenario X", "Verificar Y"]
}

Regras para o prompt gerado:
- Deve ser auto-contido (quem ler o prompt deve entender o problema sem ver o ticket)
- Incluir caminhos de arquivo especificos da plataforma AWFood
- Mencionar restricoes tecnicas (PHP 7.4, Laravel 5.6, multi-tenant)
- Se for bug: incluir passos para reproduzir e comportamento esperado
- Se for feature: incluir requisitos funcionais e exemplos de uso
- Mencionar observers que podem ser afetados
- Mencionar se precisa migration (painel e a dona de migrations)
- Incluir consideracoes de multi-tenancy quando aplicavel
- O prompt deve ser em portugues
- Responda APENAS com o JSON, sem blocos de codigo`

// System prompt COMPACTO — para IAs que ja conhecem a plataforma (ex: Claude Code com CLAUDE.md)
// Omite arquitetura, linguagem, frameworks — foca no problema e na solucao
const SYSTEM_PROMPT_COMPACT = `Voce e um engenheiro senior da plataforma AWFood. Sua tarefa e gerar um prompt de desenvolvimento estruturado para implementar a solucao de um ticket de suporte.

IMPORTANTE: A IA que recebera este prompt ja possui conhecimento previo da arquitetura da plataforma AWFood (via CLAUDE.md ou contexto equivalente). Por isso, NAO inclua no prompt:
- Descricao da arquitetura geral (servicos, portas, linguagens)
- Explicacoes sobre multi-tenancy, observers, ou padroes do projeto
- Stack tecnologico (PHP 7.4, Laravel 5.6, etc.)
- Lista de integracoes ou infraestrutura

Foque APENAS em:
- O problema especifico a ser resolvido
- Passos concretos de implementacao
- Comportamento esperado vs atual
- Restricoes especificas deste ticket (se houver)

Voce deve gerar um JSON valido com:
{
  "prompt": "O prompt conciso e direto que sera copiado para o Claude Code. Sem contexto generico de plataforma. Focado exclusivamente no problema e na implementacao.",
  "context_summary": "Resumo de 2-3 frases do problema para contexto rapido",
  "affected_files": [],
  "approach_steps": ["Passo 1: ...", "Passo 2: ..."],
  "test_suggestions": ["Testar cenario X", "Verificar Y"]
}

Regras para o prompt gerado:
- Direto ao ponto — sem introducoes ou explicacoes de contexto da plataforma
- NAO inclua affected_files — a IA de destino ja tem acesso ao codigo e vai localizar os arquivos sozinha. Retorne sempre um array vazio para affected_files
- NAO suponha caminhos de arquivos — deixe a IA de destino explorar o codigo
- Se for bug: passos para reproduzir e comportamento esperado
- Se for feature: requisitos funcionais e exemplos de uso
- O prompt deve ser em portugues
- Responda APENAS com o JSON, sem blocos de codigo`

export async function generateDevPrompt(
  ticket: TicketContext,
  provider: AIProviderClient,
  options?: DevPromptOptions
): Promise<DevPromptResult> {
  const aiHasContext = options?.ai_has_context ?? false
  const extraNotes = options?.extra_notes?.trim()

  const parts: string[] = []
  parts.push(`## Ticket: ${ticket.ticket_number} - ${ticket.title}`)
  parts.push(`Descricao: ${ticket.description}`)

  if (ticket.category) parts.push(`Categoria: ${ticket.category}`)
  if (ticket.affected_service) parts.push(`Servico afetado: ${ticket.affected_service}`)
  if (ticket.environment) parts.push(`Ambiente: ${ticket.environment}`)
  if (ticket.impact) parts.push(`Impacto: ${ticket.impact}`)

  if (ticket.steps_to_reproduce) {
    parts.push(`\nPassos para reproduzir:\n${ticket.steps_to_reproduce}`)
  }
  if (ticket.expected_behavior) {
    parts.push(`Comportamento esperado: ${ticket.expected_behavior}`)
  }
  if (ticket.actual_behavior) {
    parts.push(`Comportamento atual: ${ticket.actual_behavior}`)
  }

  if (ticket.comments.length > 0) {
    parts.push('\n## Historico de comentarios relevantes')
    // Only include internal and technical comments, limit to recent
    const relevant = ticket.comments
      .filter((c) => c.is_internal || c.body.length > 50)
      .slice(-10)
    for (const c of relevant) {
      parts.push(`[${c.is_internal ? 'INTERNO' : 'CLIENTE'}] ${c.author}: ${c.body.slice(0, 400)}`)
    }
  }

  if (ticket.previousAnalysis) {
    parts.push(`\n## Analise IA anterior: ${ticket.previousAnalysis.slice(0, 500)}`)
  }

  // Observacoes extras do desenvolvedor
  if (extraNotes) {
    parts.push(`\n## Observacoes do desenvolvedor\n${extraNotes}`)
  }

  if (aiHasContext) {
    parts.push('\nNOTA: A IA de destino ja possui conhecimento da plataforma AWFood. Gere um prompt conciso, sem repetir contexto de arquitetura.')
  }

  parts.push('\nGere o prompt de desenvolvimento para este ticket.')

  // Seleciona system prompt baseado no toggle de contexto
  const systemPrompt = aiHasContext ? SYSTEM_PROMPT_COMPACT : SYSTEM_PROMPT_FULL

  const response = await provider.chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: parts.join('\n') },
    ],
    { maxTokens: 2048, temperature: 0.3 }
  )

  let cleaned = response.content.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  try {
    const parsed = JSON.parse(cleaned)
    return {
      prompt: String(parsed.prompt ?? ''),
      context_summary: String(parsed.context_summary ?? ''),
      // Quando ai_has_context, nunca sugere arquivos — a IA de destino localiza sozinha
      affected_files: aiHasContext ? [] : (Array.isArray(parsed.affected_files) ? parsed.affected_files.map(String) : []),
      approach_steps: Array.isArray(parsed.approach_steps) ? parsed.approach_steps.map(String) : [],
      test_suggestions: Array.isArray(parsed.test_suggestions) ? parsed.test_suggestions.map(String) : [],
      model_used: response.model,
      tokens_used: response.tokensUsed.input + response.tokensUsed.output,
    }
  } catch {
    // If JSON parsing fails, use raw response as prompt
    return {
      prompt: response.content,
      context_summary: `Prompt gerado para ticket ${ticket.ticket_number}`,
      affected_files: [],
      approach_steps: [],
      test_suggestions: [],
      model_used: response.model,
      tokens_used: response.tokensUsed.input + response.tokensUsed.output,
    }
  }
}
