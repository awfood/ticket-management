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

const SYSTEM_PROMPT = `Voce e um engenheiro senior da plataforma AWFood. Sua tarefa e gerar um prompt de desenvolvimento estruturado que sera usado no Claude Code ou outra ferramenta de IA para implementar a solucao de um ticket de suporte.

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

export async function generateDevPrompt(
  ticket: TicketContext,
  provider: AIProviderClient
): Promise<DevPromptResult> {
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

  parts.push('\nGere o prompt de desenvolvimento para este ticket.')

  const response = await provider.chat(
    [
      { role: 'system', content: SYSTEM_PROMPT },
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
      affected_files: Array.isArray(parsed.affected_files) ? parsed.affected_files.map(String) : [],
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
