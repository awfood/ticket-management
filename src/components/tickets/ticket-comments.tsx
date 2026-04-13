'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  MessageSquare,
  Send,
  Lock,
  Bot,
  Settings,
  Loader2,
  Paperclip,
  Sparkles,
  Code,
  Reply,
  CornerDownRight,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { FileUpload } from '@/components/shared/file-upload'
import { RichTextEditor, RichTextViewer } from '@/components/shared/rich-text-editor'
import { DevPromptDialog } from './dev-prompt-dialog'
import type { DevPromptConfig } from './dev-prompt-dialog'
import { useUser } from '@/hooks/use-user'
import { cn } from '@/lib/utils'
import type { TicketComment, CommentType } from '@/types'

interface TicketCommentsProps {
  ticketId: string
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function getCommentIcon(type: string) {
  switch (type) {
    case 'ai_analysis':
      return Bot
    case 'dev_note':
      return Code
    case 'ai_dev_prompt':
      return Sparkles
    case 'status_change':
    case 'system':
      return Settings
    default:
      return MessageSquare
  }
}

export function TicketComments({ ticketId }: TicketCommentsProps) {
  const user = useUser()
  const queryClient = useQueryClient()
  const [body, setBody] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [replyingTo, setReplyingTo] = useState<{ id: string; authorName: string; bodyPreview: string } | null>(null)
  const [analyzingCommentId, setAnalyzingCommentId] = useState<string | null>(null)
  const [generatingDevPrompt, setGeneratingDevPrompt] = useState(false)
  const [devPromptDialogOpen, setDevPromptDialogOpen] = useState(false)
  const hasDevPermission = user.permissions.includes('ai.dev_prompt') || user.role === 'super_admin'
  const editorRef = React.useRef<HTMLDivElement>(null)
  const [commentAnalysis, setCommentAnalysis] = useState<{
    comment_id: string
    comment_analysis: {
      summary: string
      actionItems: string[]
      technicalInsights: string[]
      suggestedResponse: string | null
      newInformation: string[]
    }
  } | null>(null)

  const { data: comments, isLoading } = useQuery({
    queryKey: ['ticket-comments', ticketId],
    queryFn: async (): Promise<TicketComment[]> => {
      const res = await fetch(`/api/tickets/${ticketId}/comments`)
      if (!res.ok) throw new Error('Erro ao carregar comentarios')
      return res.json()
    },
  })

  const addComment = useMutation({
    mutationFn: async (payload: {
      body: string
      body_html?: string
      is_internal: boolean
      comment_type: string
      parent_comment_id?: string
    }) => {
      const res = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(
          (err as { error?: string }).error ?? 'Erro ao enviar comentario'
        )
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['ticket-comments', ticketId],
      })
      setBody('')
      setBodyHtml('')
      setIsInternal(false)
      setReplyingTo(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    addComment.mutate({
      body: body.trim(),
      body_html: bodyHtml || undefined,
      is_internal: isInternal,
      comment_type: isInternal ? 'internal_note' : 'reply',
      parent_comment_id: replyingTo?.id || undefined,
    })
  }

  async function handleGenerateDevPrompt(config: DevPromptConfig) {
    setDevPromptDialogOpen(false)
    setGeneratingDevPrompt(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'dev_prompt',
          extra_notes: config.extra_notes,
          ai_has_context: config.ai_has_context,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Erro ao gerar prompt')
      }
      toast.success('Prompt dev gerado e salvo como nota dev')
      queryClient.invalidateQueries({ queryKey: ['ticket-comments', ticketId] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar prompt dev')
    } finally {
      setGeneratingDevPrompt(false)
    }
  }

  async function handleAnalyzeComment(commentId: string) {
    setAnalyzingCommentId(commentId)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: commentId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Erro na analise')
      }
      const data = await res.json()
      setCommentAnalysis({ comment_id: commentId, comment_analysis: data.comment_analysis })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao analisar comentario')
    } finally {
      setAnalyzingCommentId(null)
    }
  }

  async function handleFileUpload(file: File) {
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`/api/tickets/${ticketId}/attachments`, {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      throw new Error('Erro ao fazer upload do arquivo')
    }

    toast.success('Arquivo anexado com sucesso!')
    setShowUpload(false)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Comentarios</h3>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">
        Comentarios
        {comments && comments.length > 0 && (
          <span className="ml-1 text-muted-foreground font-normal">
            ({comments.length})
          </span>
        )}
      </h3>

      {/* Comments list */}
      <div className="space-y-4">
        {(!comments || comments.length === 0) && (
          <p className="text-center text-sm text-muted-foreground py-6">
            Nenhum comentario ainda. Seja o primeiro a comentar.
          </p>
        )}

        {comments?.map((comment) => {
          const isSystem =
            comment.comment_type === 'system' ||
            comment.comment_type === 'status_change'
          const isAI = comment.comment_type === 'ai_analysis'
          const Icon = getCommentIcon(comment.comment_type)

          if (isSystem) {
            return (
              <div
                key={comment.id}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <div className="flex size-6 items-center justify-center rounded-full bg-muted">
                  <Icon className="size-3" />
                </div>
                <span>{comment.body}</span>
                <span className="ml-auto whitespace-nowrap">
                  {format(
                    new Date(comment.created_at),
                    "dd/MM/yy 'as' HH:mm",
                    { locale: ptBR }
                  )}
                </span>
              </div>
            )
          }

          return (
            <div
              key={comment.id}
              className={cn(
                'rounded-lg border p-3',
                comment.comment_type === 'ai_dev_prompt'
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                  : comment.comment_type === 'dev_note'
                    ? 'border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/20'
                    : comment.is_internal
                      ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-900/50 dark:bg-yellow-950/20'
                      : isAI
                        ? 'border-purple-200 bg-purple-50 dark:border-purple-900/50 dark:bg-purple-950/20'
                        : 'border-border bg-card'
              )}
            >
              <div className="flex items-start gap-3">
                <Avatar size="sm">
                  {comment.author?.avatar_url && (
                    <AvatarImage
                      src={comment.author.avatar_url}
                      alt={comment.author.full_name}
                    />
                  )}
                  <AvatarFallback>
                    {isAI
                      ? 'IA'
                      : comment.author
                        ? getInitials(comment.author.full_name)
                        : '??'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {isAI
                        ? 'Analise IA'
                        : comment.author?.full_name ?? 'Usuario'}
                    </span>
                    {comment.is_internal && (
                      <span className="inline-flex items-center gap-1 rounded bg-yellow-200 px-1.5 py-0.5 text-[10px] font-medium text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400">
                        <Lock className="size-2.5" />
                        Nota interna
                      </span>
                    )}
                    {isAI && (
                      <span className="inline-flex items-center gap-1 rounded bg-purple-200 px-1.5 py-0.5 text-[10px] font-medium text-purple-800 dark:bg-purple-900/50 dark:text-purple-400">
                        <Bot className="size-2.5" />
                        IA
                      </span>
                    )}
                    {comment.comment_type === 'dev_note' && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-400">
                        <Code className="size-2.5" />
                        Dev
                      </span>
                    )}
                    {comment.comment_type === 'ai_dev_prompt' && (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-200 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                        <Sparkles className="size-2.5" />
                        Prompt Dev
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                      {format(
                        new Date(comment.created_at),
                        "dd/MM/yy 'as' HH:mm",
                        { locale: ptBR }
                      )}
                    </span>
                  </div>
                  {/* Reply quote (referenced parent comment) */}
                  {comment.parent_comment && (
                    <div className="mt-1 mb-2 flex items-start gap-1.5 rounded border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs">
                      <CornerDownRight className="size-3 shrink-0 mt-0.5 text-muted-foreground" />
                      <div className="min-w-0">
                        <span className="font-medium text-muted-foreground">
                          {(comment.parent_comment as unknown as { author: { full_name: string } | null })?.author?.full_name ?? 'Usuario'}:
                        </span>
                        <span className="ml-1 text-muted-foreground truncate block">
                          {(comment.parent_comment as unknown as { body: string }).body?.slice(0, 120)}
                          {(comment.parent_comment as unknown as { body: string }).body?.length > 120 ? '...' : ''}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="mt-1 text-sm break-words">
                    {comment.body_html ? (
                      <RichTextViewer content={comment.body_html} />
                    ) : (
                      <div className="whitespace-pre-wrap">{comment.body}</div>
                    )}
                  </div>

                  {/* Action buttons */}
                  {!isSystem && (
                    <div className="mt-2 flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-muted-foreground hover:text-foreground gap-1"
                        onClick={() => {
                          setReplyingTo({
                            id: comment.id,
                            authorName: comment.author?.full_name ?? 'Usuario',
                            bodyPreview: comment.body.slice(0, 100),
                          })
                          editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }}
                      >
                        <Reply className="size-3" />
                        Responder
                      </Button>
                      {user.isInternal && !isAI && comment.comment_type !== 'dev_note' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-muted-foreground hover:text-foreground gap-1"
                          onClick={() => handleAnalyzeComment(comment.id)}
                          disabled={analyzingCommentId === comment.id}
                        >
                          {analyzingCommentId === comment.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Sparkles className="size-3" />
                          )}
                          Analisar
                        </Button>
                      )}
                      {hasDevPermission && comment.comment_type !== 'dev_note' && comment.comment_type !== 'ai_dev_prompt' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-amber-600 hover:text-amber-800 hover:bg-amber-50 gap-1 dark:text-amber-400 dark:hover:bg-amber-950"
                          onClick={() => setDevPromptDialogOpen(true)}
                          disabled={generatingDevPrompt}
                        >
                          {generatingDevPrompt ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Code className="size-3" />
                          )}
                          Gerar Prompt Dev
                        </Button>
                      )}

                      {/* Inline analysis result */}
                      {commentAnalysis?.comment_id === comment.id && (
                        <div className="mt-2 rounded-md border border-purple-200 bg-purple-50 p-3 text-xs space-y-2 dark:border-purple-800 dark:bg-purple-950/30">
                          <p className="font-medium text-purple-800 dark:text-purple-300 flex items-center gap-1">
                            <Sparkles className="size-3" />
                            Analise do comentario
                          </p>
                          <p className="text-purple-700 dark:text-purple-400">
                            {commentAnalysis.comment_analysis.summary}
                          </p>
                          {commentAnalysis.comment_analysis.technicalInsights.length > 0 && (
                            <div>
                              <p className="font-medium text-purple-800 dark:text-purple-300">Insights tecnicos:</p>
                              <ul className="list-disc pl-4 text-purple-700 dark:text-purple-400">
                                {commentAnalysis.comment_analysis.technicalInsights.map((i, idx) => (
                                  <li key={idx}>{i}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {commentAnalysis.comment_analysis.actionItems.length > 0 && (
                            <div>
                              <p className="font-medium text-purple-800 dark:text-purple-300">Acoes necessarias:</p>
                              <ul className="list-disc pl-4 text-purple-700 dark:text-purple-400">
                                {commentAnalysis.comment_analysis.actionItems.map((a, idx) => (
                                  <li key={idx}>{a}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {commentAnalysis.comment_analysis.suggestedResponse && (
                            <div>
                              <p className="font-medium text-purple-800 dark:text-purple-300">Resposta sugerida:</p>
                              <p className="text-purple-700 dark:text-purple-400 italic">
                                {commentAnalysis.comment_analysis.suggestedResponse}
                              </p>
                            </div>
                          )}
                          {commentAnalysis.comment_analysis.newInformation.length > 0 && (
                            <div>
                              <p className="font-medium text-purple-800 dark:text-purple-300">Informacoes novas:</p>
                              <ul className="list-disc pl-4 text-purple-700 dark:text-purple-400">
                                {commentAnalysis.comment_analysis.newInformation.map((n, idx) => (
                                  <li key={idx}>{n}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add comment form */}
      <div ref={editorRef} />
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Reply indicator */}
        {replyingTo && (
          <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs dark:border-blue-800 dark:bg-blue-950/30">
            <CornerDownRight className="size-3 text-blue-500 shrink-0" />
            <span className="text-blue-700 dark:text-blue-300">
              Respondendo a <strong>{replyingTo.authorName}</strong>: {replyingTo.bodyPreview}{replyingTo.bodyPreview.length >= 100 ? '...' : ''}
            </span>
            <button
              type="button"
              className="ml-auto shrink-0 text-blue-400 hover:text-blue-600"
              onClick={() => setReplyingTo(null)}
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <RichTextEditor
          content={bodyHtml}
          onChange={(html, text) => {
            setBodyHtml(html)
            setBody(text)
          }}
          placeholder="Escreva um comentario..."
          minHeight="80px"
        />

        {showUpload && (
          <FileUpload
            onUpload={handleFileUpload}
            accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.zip"
          />
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {user.isInternal && (
              <div className="flex items-center gap-2">
                <Switch
                  id="internal"
                  checked={isInternal}
                  onCheckedChange={setIsInternal}
                />
                <Label htmlFor="internal" className="text-xs cursor-pointer">
                  Nota interna
                </Label>
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowUpload(!showUpload)}
            >
              <Paperclip className="size-4" />
              Anexar
            </Button>
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={!body.trim() || addComment.isPending}
          >
            {addComment.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Enviar
          </Button>
        </div>
      </form>

      {/* Dialog de configuracao do Prompt Dev */}
      <DevPromptDialog
        open={devPromptDialogOpen}
        onOpenChange={setDevPromptDialogOpen}
        onConfirm={handleGenerateDevPrompt}
      />
    </div>
  )
}
