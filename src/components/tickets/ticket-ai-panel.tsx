'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Brain,
  Loader2,
  Lightbulb,
  AlertTriangle,
  Wrench,
  User,
  Code,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { TicketStatusBadge } from './ticket-status-badge'
import { useUser } from '@/hooks/use-user'
import type { TicketAnalysis } from '@/lib/ai/ticket-analyzer'
import type { DevPromptResult } from '@/lib/ai/dev-prompt-generator'
import type { SimilarTicket } from '@/lib/ai/similar-finder'
import type { TicketStatus } from '@/types'

interface TicketAIPanelProps {
  ticketId: string
}

interface AnalysisResponse {
  analysis: TicketAnalysis
  similar_tickets: SimilarTicket[]
  analysis_id: string | null
}

export function TicketAIPanel({ ticketId }: TicketAIPanelProps) {
  const user = useUser()
  const [expanded, setExpanded] = useState(true)
  const [devPromptResult, setDevPromptResult] = useState<DevPromptResult | null>(null)
  const [devPromptCopied, setDevPromptCopied] = useState(false)
  const hasDevPermission = user.permissions.includes('ai.dev_prompt') || user.role === 'super_admin'

  // Fetch previous analyses
  const { data: previousAnalyses, isLoading: loadingPrevious } = useQuery({
    queryKey: ['ticket-ai-analyses', ticketId],
    queryFn: async () => {
      // Check for previous ai_analysis comments
      const res = await fetch(`/api/tickets/${ticketId}/comments`)
      if (!res.ok) return []
      const comments = await res.json()
      return (comments as Array<{ comment_type: string; body: string; created_at: string }>).filter(
        (c) => c.comment_type === 'ai_analysis'
      )
    },
  })

  const runDevPrompt = useMutation({
    mutationFn: async (): Promise<{ dev_prompt: DevPromptResult }> => {
      const res = await fetch(`/api/tickets/${ticketId}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'dev_prompt' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Erro ao gerar prompt')
      }
      return res.json()
    },
    onSuccess: (data) => {
      setDevPromptResult(data.dev_prompt)
      toast.success('Prompt de desenvolvimento gerado')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const runAnalysis = useMutation({
    mutationFn: async (): Promise<AnalysisResponse> => {
      const res = await fetch(`/api/tickets/${ticketId}/ai`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(
          (err as { error?: string }).error ?? 'Erro ao executar analise'
        )
      }
      return res.json()
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const analysis = runAnalysis.data?.analysis
  const similarTickets = runAnalysis.data?.similar_tickets ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Brain className="size-4" />
          Analise IA
        </h3>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </Button>
      </div>

      {expanded && (
        <div className="space-y-3">
          {/* Run analysis button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => runAnalysis.mutate()}
            disabled={runAnalysis.isPending}
          >
            {runAnalysis.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Brain className="size-4" />
            )}
            {runAnalysis.isPending
              ? 'Analisando...'
              : 'Analisar com IA'}
          </Button>

          {/* Dev Prompt button (developers only) */}
          {hasDevPermission && (
            <Button
              variant="outline"
              size="sm"
              className="w-full border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950"
              onClick={() => runDevPrompt.mutate()}
              disabled={runDevPrompt.isPending}
            >
              {runDevPrompt.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Code className="size-4" />
              )}
              {runDevPrompt.isPending ? 'Gerando prompt...' : 'Gerar Prompt Dev'}
            </Button>
          )}

          {/* Dev Prompt Result */}
          {devPromptResult && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  <Code className="size-3" />
                  Prompt para Claude Code
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(devPromptResult.prompt)
                    setDevPromptCopied(true)
                    setTimeout(() => setDevPromptCopied(false), 2000)
                    toast.success('Prompt copiado')
                  }}
                >
                  {devPromptCopied ? 'Copiado!' : 'Copiar prompt'}
                </Button>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400">{devPromptResult.context_summary}</p>
              <pre className="max-h-[300px] overflow-auto rounded bg-zinc-900 p-3 text-xs text-zinc-100 font-mono whitespace-pre-wrap">{devPromptResult.prompt}</pre>
              {devPromptResult.affected_files.length > 0 && (
                <div className="text-xs">
                  <p className="font-medium text-amber-800 dark:text-amber-300">Arquivos afetados:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {devPromptResult.affected_files.map((f, i) => (
                      <code key={i} className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] dark:bg-amber-900">{f}</code>
                    ))}
                  </div>
                </div>
              )}
              {devPromptResult.test_suggestions.length > 0 && (
                <div className="text-xs">
                  <p className="font-medium text-amber-800 dark:text-amber-300">Testes sugeridos:</p>
                  <ul className="list-disc pl-4 mt-1 text-amber-700 dark:text-amber-400">
                    {devPromptResult.test_suggestions.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              )}
              <p className="text-[10px] text-amber-600 dark:text-amber-500">
                {devPromptResult.tokens_used} tokens | Salvo como nota dev no historico
              </p>
            </div>
          )}

          {/* Loading state */}
          {(runAnalysis.isPending || runDevPrompt.isPending) && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          )}

          {/* Analysis results */}
          {analysis && !runAnalysis.isPending && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              {/* Diagnosis */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Lightbulb className="size-3" />
                  Diagnostico
                </div>
                <p className="mt-1 text-sm">{analysis.diagnosis}</p>
              </div>

              <Separator />

              {/* Possible causes */}
              {analysis.possibleCauses.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <AlertTriangle className="size-3" />
                    Possiveis causas
                  </div>
                  <ul className="mt-1 space-y-1">
                    {analysis.possibleCauses.map((cause, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="shrink-0 text-muted-foreground">
                          {i + 1}.
                        </span>
                        {cause}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions for client */}
              {analysis.suggestedActions.forClient.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <User className="size-3" />
                      Acoes sugeridas para o cliente
                    </div>
                    <ul className="mt-1 space-y-1">
                      {analysis.suggestedActions.forClient.map(
                        (action, i) => (
                          <li key={i} className="flex gap-2 text-sm">
                            <span className="shrink-0 text-muted-foreground">
                              -
                            </span>
                            {action}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                </>
              )}

              {/* Actions for development */}
              {analysis.suggestedActions.forDevelopment.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Code className="size-3" />
                      Acoes sugeridas para desenvolvimento
                    </div>
                    <ul className="mt-1 space-y-1">
                      {analysis.suggestedActions.forDevelopment.map(
                        (action, i) => (
                          <li key={i} className="flex gap-2 text-sm">
                            <span className="shrink-0 text-muted-foreground">
                              -
                            </span>
                            {action}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                </>
              )}

              {/* Suggestions */}
              <Separator />
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded bg-muted px-2 py-0.5">
                  <Wrench className="mr-1 inline size-3" />
                  Servico: {analysis.suggestedService}
                </span>
                <span className="rounded bg-muted px-2 py-0.5">
                  Confianca: {Math.round(analysis.confidence * 100)}%
                </span>
              </div>
            </div>
          )}

          {/* Similar tickets */}
          {similarTickets.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Tickets similares
              </p>
              <div className="space-y-1.5">
                {similarTickets.map((ticket) => (
                  <Link
                    key={ticket.id}
                    href={`/tickets/${ticket.id}`}
                    className="flex items-center gap-2 rounded-md border border-border p-2 text-sm hover:bg-muted/50 transition-colors"
                  >
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {ticket.ticket_number}
                    </span>
                    <span className="flex-1 truncate">{ticket.title}</span>
                    <TicketStatusBadge
                      status={ticket.status as TicketStatus}
                      size="sm"
                    />
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {Math.round(ticket.similarity * 100)}%
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Previous analyses indicator */}
          {previousAnalyses && previousAnalyses.length > 0 && !analysis && (
            <p className="text-xs text-muted-foreground">
              {previousAnalyses.length} analise{previousAnalyses.length > 1 ? 's' : ''}{' '}
              anterior{previousAnalyses.length > 1 ? 'es' : ''} disponivel{previousAnalyses.length > 1 ? 'eis' : ''} nos comentarios.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
