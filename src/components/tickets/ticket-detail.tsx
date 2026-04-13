'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ArrowLeft,
  Clock,
  Calendar,
  Building2,
  User,
  Tag,
  Trash2,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { TicketStatusBadge, STATUS_CONFIG } from './ticket-status-badge'
import { TicketPriorityBadge, PRIORITY_CONFIG } from './ticket-priority-badge'
import { TicketComments } from './ticket-comments'
import { TicketHistory } from './ticket-history'
import { TicketAIPanel } from './ticket-ai-panel'
import { TicketExternalLinks } from './ticket-external-links'
import { RichTextViewer } from '@/components/shared/rich-text-editor'
import { useUser } from '@/hooks/use-user'
import type {
  Ticket,
  TicketStatus,
  TicketPriority,
  Profile,
} from '@/types'

interface TicketDetailProps {
  ticket: Ticket & { comments_count: number }
}

export function TicketDetail({ ticket: initialTicket }: TicketDetailProps) {
  const router = useRouter()
  const user = useUser()
  const queryClient = useQueryClient()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Refetch ticket data to keep updated
  const { data: ticket } = useQuery({
    queryKey: ['ticket', initialTicket.id],
    queryFn: async () => {
      const res = await fetch(`/api/tickets/${initialTicket.id}`)
      if (!res.ok) throw new Error('Não foi possível carregar o ticket. Tente recarregar a página.')
      return res.json() as Promise<Ticket & { comments_count: number }>
    },
    initialData: initialTicket,
  })

  // Load internal agents for assignee selector
  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: async (): Promise<Profile[]> => {
      // Try to fetch internal profiles
      try {
        const res = await fetch('/api/users?is_internal=true')
        if (res.ok) {
          const data = await res.json()
          return Array.isArray(data) ? data : data?.data ?? []
        }
      } catch {
        // endpoint may not exist yet
      }
      return []
    },
  })

  const updateTicket = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(
          (err as { error?: string }).error ?? 'Falha ao atualizar o ticket. Verifique sua conexão e tente novamente.'
        )
      }
      return res.json()
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['ticket', ticket.id], updated)
      queryClient.invalidateQueries({
        queryKey: ['ticket-history', ticket.id],
      })
      toast.success('Ticket atualizado!')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const deleteTicket = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Não foi possível excluir o ticket. Verifique se você tem permissão.')
    },
    onSuccess: () => {
      toast.success('Ticket excluído.')
      router.push('/tickets')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  function handleStatusChange(status: string | null) {
    if (status) updateTicket.mutate({ status })
  }

  function handlePriorityChange(priority: string | null) {
    if (priority) updateTicket.mutate({ priority })
  }

  function handleAssigneeChange(assigneeId: string | null) {
    if (!assigneeId) return
    updateTicket.mutate({
      assigned_to: assigneeId === 'unassigned' ? null : assigneeId,
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/tickets')}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">
              {ticket.ticket_number}
            </span>
            <TicketStatusBadge status={ticket.status} />
            <TicketPriorityBadge priority={ticket.priority} />
          </div>
          <h1 className="mt-1 text-lg font-semibold">{ticket.title}</h1>
        </div>
        {user.isInternal && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={deleteTicket.isPending}
          >
            {deleteTicket.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Excluir ticket
          </Button>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left column: Main content */}
        <div className="space-y-6">
          {/* Description */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold mb-2">Descrição</h3>
            {ticket.description_html ? (
              <RichTextViewer content={ticket.description_html} />
            ) : (
              <div className="prose prose-sm max-w-none text-sm whitespace-pre-wrap">
                {ticket.description}
              </div>
            )}

            {/* Additional fields */}
            {(ticket.steps_to_reproduce ||
              ticket.expected_behavior ||
              ticket.actual_behavior) && (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                {ticket.steps_to_reproduce && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Passos para reproduzir
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {ticket.steps_to_reproduce}
                    </p>
                  </div>
                )}
                {ticket.expected_behavior && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Comportamento esperado
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {ticket.expected_behavior}
                    </p>
                  </div>
                )}
                {ticket.actual_behavior && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Comportamento atual
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {ticket.actual_behavior}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Comments / History tabs */}
          <Tabs defaultValue="comments">
            <TabsList>
              <TabsTrigger value="comments">
                Comentários ({ticket.comments_count})
              </TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>
            <TabsContent value="comments" className="mt-4">
              <TicketComments ticketId={ticket.id} />
            </TabsContent>
            <TabsContent value="history" className="mt-4">
              <TicketHistory ticketId={ticket.id} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right column: Sidebar */}
        <div className="space-y-4">
          {/* Status */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Status
              </label>
              <Select
                value={ticket.status}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_CONFIG) as TicketStatus[]).map(
                    (status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_CONFIG[status].label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Prioridade
              </label>
              <Select
                value={ticket.priority}
                onValueChange={handlePriorityChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_CONFIG) as TicketPriority[]).map(
                    (priority) => (
                      <SelectItem key={priority} value={priority}>
                        {PRIORITY_CONFIG[priority].label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Assignee */}
            {user.isInternal && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Responsável
                </label>
                <Select
                  value={ticket.assigned_to ?? 'unassigned'}
                  onValueChange={handleAssigneeChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Não atribuído" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Não atribuído</SelectItem>
                    {agents?.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Separator />

            {/* Info fields */}
            <div className="space-y-3 text-sm">
              {/* Organization */}
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Organização</p>
                  <p className="font-medium">
                    {ticket.organization?.name ?? '-'}
                  </p>
                </div>
              </div>

              {/* Creator */}
              <div className="flex items-center gap-2">
                <User className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Criado por</p>
                  <p className="font-medium">
                    {ticket.creator?.full_name ?? '-'}
                  </p>
                </div>
              </div>

              {/* Created at */}
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Criado em</p>
                  <p className="font-medium">
                    {format(
                      new Date(ticket.created_at),
                      "dd/MM/yyyy 'as' HH:mm",
                      { locale: ptBR }
                    )}
                  </p>
                </div>
              </div>

              {/* Updated at */}
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Atualizado em</p>
                  <p className="font-medium">
                    {format(
                      new Date(ticket.updated_at),
                      "dd/MM/yyyy 'as' HH:mm",
                      { locale: ptBR }
                    )}
                  </p>
                </div>
              </div>

              {/* Category */}
              {ticket.category && (
                <div className="flex items-center gap-2">
                  <Tag className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Categoria</p>
                    <p className="font-medium">{ticket.category}</p>
                  </div>
                </div>
              )}

              {/* Affected service */}
              {ticket.affected_service && (
                <div className="flex items-center gap-2">
                  <Tag className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Serviço afetado
                    </p>
                    <p className="font-medium">{ticket.affected_service}</p>
                  </div>
                </div>
              )}

              {/* SLA */}
              {ticket.sla_breach && (
                <div className="rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  Prazo de resposta excedido
                </div>
              )}

              {/* Tags */}
              {ticket.tags.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {ticket.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* External Links */}
          <div className="rounded-lg border border-border bg-card p-4">
            <TicketExternalLinks ticketId={ticket.id} />
          </div>

          {/* AI Analysis */}
          {user.isInternal && (
            <div className="rounded-lg border border-border bg-card p-4">
              <TicketAIPanel ticketId={ticket.id} />
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              O ticket <strong>{ticket.ticket_number}</strong> e todos os seus comentários serão excluídos permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleteTicket.mutate()}
            >
              <Trash2 className="size-4" />
              Excluir ticket
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
